'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from './supabase';

// 🏆 ตารางแปลงอันดับ (Place) เป็นคะแนนอันดับ (Placement Points) อัตโนมัติ
const placementPointsMap: Record<number, number> = {
  1: 10,
  2: 6,
  3: 5,
  4: 4,
  5: 3,
  6: 2,
  7: 1,
  8: 1,
  // 9th ถึง 16th ได้ 0 แต้ม
};

export default function ScrimManagementApp() {
  const [activeTab, setActiveTab] = useState<'d1' | 'd2' | 'match' | 'history' | 'halloffame'>('d1');
  const [teams, setTeams] = useState<any[]>([]);
  const [allTeams, setAllTeams] = useState<any[]>([]);
  const [matchLogs, setMatchLogs] = useState<any[]>([]);
  const [historySeasons, setHistorySeasons] = useState<any[]>([]);
  const [selectedSeason, setSelectedSeason] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);

  // State สำหรับระบบแอดมิน
  const [isAdmin, setIsAdmin] = useState(false);

  // State สำหรับ Modal ประวัติทีมย้อนหลัง
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalTeamName, setModalTeamName] = useState('');
  const [teamHistoryResult, setTeamHistoryResult] = useState<any[]>([]);
  const [modalLoading, setModalLoading] = useState(false);

  // State สำหรับทำเนียบทีมภาพรวมทั้งหมด
  const [hallOfFameData, setHallOfFameData] = useState<any[]>([]);

  // State สำหรับช่องกรอกคะแนนรายแมตช์ (เปลี่ยนจากกรอกแต้มเอง เป็นกรอก "อันดับ Place" และ "คิล Kills")
  const [gameDivision, setGameDivision] = useState<'1' | '2'>('1');
  const [gameNumber, setGameNumber] = useState('1');
  const [mapName, setMapName] = useState('Erangel');
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [teamPlace, setTeamPlace] = useState<number | ''>(''); // กรอกอันดับ (1-16)
  const [teamKills, setTeamKills] = useState<number | ''>(''); // กรอกจำนวนคิล
  const [isWWCD, setIsWWCD] = useState(false);

  // คำนวณแต้มพรีวิวสดๆ หน้าฟอร์มแอดมิน
  const calculatedPlacePts = typeof teamPlace === 'number' ? (placementPointsMap[teamPlace] || 0) : 0;
  const calculatedKillPts = typeof teamKills === 'number' ? teamKills : 0;
  const previewTotalMatchPoints = teamPlace !== '' ? calculatedPlacePts + calculatedKillPts : 0;

  const [seasonNote, setSeasonNote] = useState('');

  // State สำหรับฟอร์มเพิ่มทีมใหม่
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamDivision, setNewTeamDivision] = useState<'1' | '2'>('2');

  const fetchTeamsAndLogs = async () => {
    setLoading(true);
    if (activeTab === 'history') {
      await fetchHistory();
    } else if (activeTab === 'halloffame') {
      await fetchHallOfFame();
    } else if (activeTab !== 'match') {
      const divId = activeTab === 'd1' ? 1 : 2;
      const { data, error } = await supabase
        .from('teams')
        .select('*')
        .eq('division_id', divId)
        .order('total_points', { ascending: false });

      if (error) console.error('Error fetching teams:', error);
      else if (data) {
        // จัดเรียงตามกฎ Tiebreaker ทันทีที่ดึงข้อมูล
        setTeams(sortLeaderboard(data));
      }
    }

    const { data: allData } = await supabase
      .from('teams')
      .select('*')
      .order('team_name', { ascending: true });
    if (allData) setAllTeams(allData);

    const { data: logsData, error: logErr } = await supabase.from('match_logs').select('*');
    if (logErr) console.error('Error fetching match_logs:', logErr);
    if (logsData) setMatchLogs(logsData);

    setLoading(false);
  };

  // ⚖️ ฟังก์ชันจัดอันดับตามกฎ Tiebreaker ทั้ง 4 ข้อ
  const sortLeaderboard = (teamList: any[]) => {
    return [...teamList].sort((a, b) => {
      // 1. คะแนนรวมมากที่สุด
      if ((b.total_points || 0) !== (a.total_points || 0)) {
        return (b.total_points || 0) - (a.total_points || 0);
      }
      // 2. จำนวน WWCD มากที่สุด
      if ((b.wwcd || 0) !== (a.wwcd || 0)) {
        return (b.wwcd || 0) - (a.wwcd || 0);
      }
      // 3. คะแนนอันดับรวม (Placement Points) มากที่สุด
      if ((b.place_points || 0) !== (a.place_points || 0)) {
        return (b.place_points || 0) - (a.place_points || 0);
      }
      // 4. คะแนนคิลรวม (Elimination Points) มากที่สุด
      return (b.kill_points || 0) - (a.kill_points || 0);
    });
  };

  const fetchHistory = async () => {
    const { data, error } = await supabase
      .from('season_history')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching history:', error);
    } else if (data) {
      setHistorySeasons(data);
      if (data.length > 0 && !selectedSeason) {
        setSelectedSeason(data[0]);
      }
    }
  };

  const fetchHallOfFame = async () => {
    const { data: historyData } = await supabase
      .from('season_history')
      .select('*')
      .order('created_at', { ascending: false });

    if (!historyData) {
      setHallOfFameData([]);
      return;
    }

    const teamMap: { [key: string]: { team_name: string; seasons: string[] } } = {};

    historyData.forEach((season) => {
      const seasonName = season.season_name;

      season.d1_snapshot?.forEach((t: any) => {
        const name = t.team_name.trim();
        const key = name.toLowerCase();
        if (!teamMap[key]) {
          teamMap[key] = { team_name: name, seasons: [] };
        }
        if (!teamMap[key].seasons.includes(seasonName)) {
          teamMap[key].seasons.push(seasonName);
        }
      });

      season.d2_snapshot?.forEach((t: any) => {
        const name = t.team_name.trim();
        const key = name.toLowerCase();
        if (!teamMap[key]) {
          teamMap[key] = { team_name: name, seasons: [] };
        }
        if (!teamMap[key].seasons.includes(seasonName)) {
          teamMap[key].seasons.push(seasonName);
        }
      });
    });

    setHallOfFameData(Object.values(teamMap));
  };

  useEffect(() => {
    fetchTeamsAndLogs();
  }, [activeTab]);

  useEffect(() => {
    if (selectedTeamId && gameNumber) {
      const existingLog = matchLogs.find(
        (l) =>
          l.team_id.toString() === selectedTeamId.toString() &&
          l.game_number.toString() === gameNumber.toString()
      );
      if (existingLog) {
        // แปลงกลับจากแต้มอันดับเป็นอันดับ (Place) เพื่อให้แอดมินแก้ไขได้ง่าย
        // หรือถ้าใน match_logs เก็บค่า place ไว้โดยตรงจะสะดวกยิ่งขึ้น
        setTeamPlace(existingLog.place ?? '');
        setTeamKills(existingLog.kill_points ?? '');
        setIsWWCD(existingLog.wwcd === 1);
        setMapName(existingLog.map_name || 'Erangel');
      } else {
        setTeamPlace('');
        setTeamKills('');
        setIsWWCD(false);
      }
    }
  }, [selectedTeamId, gameNumber, matchLogs]);

  const handleOpenTeamHistoryModal = async (teamName: string) => {
    setModalTeamName(teamName);
    setIsModalOpen(true);
    setModalLoading(true);

    const { data: historyData } = await supabase
      .from('season_history')
      .select('*')
      .order('created_at', { ascending: false });

    if (!historyData) {
      setTeamHistoryResult([]);
      setModalLoading(false);
      return;
    }

    const results: any[] = [];
    const keyword = teamName.trim().toLowerCase();

    historyData.forEach((season) => {
      const foundInD1 = season.d1_snapshot?.find(
        (t: any) => t.team_name.toLowerCase() === keyword
      );
      if (foundInD1) {
        const rank = season.d1_snapshot.findIndex((t: any) => t.team_name.toLowerCase() === keyword) + 1;
        results.push({
          season_id: season.id,
          season_name: season.season_name,
          division: 'Division 1',
          rank: rank,
          ...foundInD1,
        });
      }

      const foundInD2 = season.d2_snapshot?.find(
        (t: any) => t.team_name.toLowerCase() === keyword
      );
      if (foundInD2) {
        const rank = season.d2_snapshot.findIndex((t: any) => t.team_name.toLowerCase() === keyword) + 1;
        results.push({
          season_id: season.id,
          season_name: season.season_name,
          division: 'Division 2',
          rank: rank,
          ...foundInD2,
        });
      }
    });

    setTeamHistoryResult(results);
    setModalLoading(false);
  };

  const handleToggleAdmin = () => {
    if (isAdmin) {
      setIsAdmin(false);
      if (activeTab === 'match') setActiveTab('d1');
      alert('🔒 ออกจากระบบแอดมินแล้ว');
    } else {
      const pass = prompt('🔑 กรุณากรอกรหัสผ่านแอดมิน:');
      if (pass === 'coachway123') {
        setIsAdmin(true);
        alert('🔓 เข้าสู่ระบบแอดมินสำเร็จ!');
      } else if (pass !== null) {
        alert('❌ รหัสผ่านไม่ถูกต้อง');
      }
    }
  };

  const handleAddTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    if (!newTeamName.trim()) return;

    const targetDivision = parseInt(newTeamDivision);
    const currentD1Count = allTeams.filter(t => t.division_id === 1).length;
    const currentD2Count = allTeams.filter(t => t.division_id === 2).length;

    if (targetDivision === 1 && currentD1Count >= 16) {
      alert(`⚠️ Division 1 เต็มแล้ว`);
      return;
    }
    if (targetDivision === 2 && currentD2Count >= 20) {
      alert(`⚠️ Division 2 เต็มแล้ว`);
      return;
    }

    setProcessing(true);
    try {
      await supabase.from('teams').insert([
        {
          team_name: newTeamName.trim(),
          division_id: targetDivision,
          total_points: 0,
          place_points: 0,
          kill_points: 0,
          wwcd: 0,
        },
      ]);
      alert(`✅ เพิ่มทีมสำเร็จ!`);
      setNewTeamName('');
      await fetchTeamsAndLogs();
    } catch (err) {
      console.error(err);
    } finally {
      setProcessing(false);
    }
  };

  const handleDeleteTeam = async (teamId: number, teamName: string) => {
    if (!isAdmin) return;
    if (!confirm(`⚠️ ยืนยันการลบทีม "${teamName}"?`)) return;

    setProcessing(true);
    try {
      await supabase.from('match_logs').delete().eq('team_id', teamId);
      await supabase.from('teams').delete().eq('id', teamId);
      alert(`🗑️ ลบทีมเรียบร้อย`);
      await fetchTeamsAndLogs();
    } catch (err) {
      console.error(err);
    } finally {
      setProcessing(false);
    }
  };

  // 🚀 บันทึกคะแนนโดยระบบแปลง "อันดับ" เป็น "คะแนนอันดับ" ให้อัตโนมัติ
  const handleSaveMatchScore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    if (!selectedTeamId || teamPlace === '') return;

    const placeVal = Number(teamPlace);
    const killsVal = Number(teamKills) || 0;
    
    // แปลงอันดับเป็นแต้มตามตารางเรทคะแนน
    const pPoints = placementPointsMap[placeVal] || 0;
    const kPoints = killsVal; // 1 คิล = 1 แต้ม
    const newMatchTotal = pPoints + kPoints;

    setProcessing(true);
    try {
      const existingLog = matchLogs.find(
        (l) =>
          l.team_id.toString() === selectedTeamId.toString() &&
          l.game_number.toString() === gameNumber.toString()
      );

      const { data: teamData } = await supabase
        .from('teams')
        .select('*')
        .eq('id', selectedTeamId)
        .single();

      if (!teamData) {
        setProcessing(false);
        return;
      }

      let updatedWWCD = teamData.wwcd || 0;
      let updatedPlace = teamData.place_points || 0;
      let updatedKill = teamData.kill_points || 0;
      let updatedTotal = teamData.total_points || 0;

      if (existingLog) {
        const oldWWCDVal = existingLog.wwcd || 0;
        const oldPlaceVal = existingLog.place_points || 0;
        const oldKillVal = existingLog.kill_points || 0;
        const oldTotalVal = oldPlaceVal + oldKillVal;

        if (isWWCD && oldWWCDVal === 0) updatedWWCD = (teamData.wwcd || 0) + 1;
        else if (!isWWCD && oldWWCDVal > 0) updatedWWCD = Math.max(0, (teamData.wwcd || 0) - 1);

        updatedPlace = updatedPlace - oldPlaceVal + pPoints;
        updatedKill = updatedKill - oldKillVal + kPoints;
        updatedTotal = updatedTotal - oldTotalVal + newMatchTotal;

        await supabase
          .from('match_logs')
          .update({ 
            map_name: mapName, 
            place: placeVal, 
            place_points: pPoints, 
            kill_points: kPoints, 
            wwcd: isWWCD ? 1 : 0 
          })
          .eq('id', existingLog.id);
      } else {
        updatedWWCD = isWWCD ? updatedWWCD + 1 : updatedWWCD;
        updatedPlace += pPoints;
        updatedKill += kPoints;
        updatedTotal += newMatchTotal;

        await supabase.from('match_logs').insert([
          {
            team_id: parseInt(selectedTeamId),
            division_id: parseInt(gameDivision),
            game_number: parseInt(gameNumber),
            map_name: mapName,
            place: placeVal,
            place_points: pPoints,
            kill_points: kPoints,
            wwcd: isWWCD ? 1 : 0,
          },
        ]);
      }

      await supabase
        .from('teams')
        .update({ 
          wwcd: updatedWWCD, 
          place_points: updatedPlace, 
          kill_points: updatedKill, 
          total_points: updatedTotal 
        })
        .eq('id', selectedTeamId);

      alert(`✅ บันทึกคะแนนสำเร็จ! (อันดับ ${placeVal} ได้รับ ${pPoints} แต้ม + คิล ${kPoints} แต้ม)`);
      await fetchTeamsAndLogs();
    } catch (err) {
      console.error(err);
    } finally {
      setProcessing(false);
    }
  };

  const handleNextSeasonTransition = async () => {
    if (!isAdmin || !seasonNote.trim()) {
      alert('กรุณากรอกชื่อซีซั่นก่อน');
      return;
    }
    if (!confirm(`ยืนยันจบซีซั่น "${seasonNote}" และสลับดิวิชัน?`)) return;

    setProcessing(true);
    try {
      const { data: d1Data } = await supabase.from('teams').select('*').eq('division_id', 1).order('total_points', { ascending: false });
      const { data: d2Data } = await supabase.from('teams').select('*').eq('division_id', 2).order('total_points', { ascending: false });

      if (!d1Data || !d2Data) return;

      const d1Full = sortLeaderboard(d1Data).slice(0, 16);
      const d2Full = sortLeaderboard(d2Data).slice(0, 20);

      await supabase.from('season_history').insert([
        { season_name: seasonNote, d1_snapshot: d1Full, d2_snapshot: d2Full },
      ]);

      const d1RemainingSafe = d1Full.slice(0, 12);
      const finalD1Relegated = d1Full.slice(12, 16);
      const finalD2Promoted = d2Full.slice(0, 4);
      const finalD2Remaining = d2Full.slice(4, 20);

      for (const team of [...d1RemainingSafe, ...finalD2Promoted]) {
        await supabase.from('teams').update({ division_id: 1, wwcd: 0, place_points: 0, kill_points: 0, total_points: 0 }).eq('id', team.id);
      }
      for (const team of [...finalD1Relegated, ...finalD2Remaining]) {
        await supabase.from('teams').update({ division_id: 2, wwcd: 0, place_points: 0, kill_points: 0, total_points: 0 }).eq('id', team.id);
      }

      await supabase.from('match_logs').delete().neq('id', 0);
      alert(`จบซีซั่นเรียบร้อย!`);
      setSeasonNote('');
      fetchTeamsAndLogs();
    } catch (err) {
      console.error(err);
    } finally {
      setProcessing(false);
    }
  };

  const currentD1Count = allTeams.filter(t => t.division_id === 1).length;
  const currentD2Count = allTeams.filter(t => t.division_id === 2).length;

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 font-sans relative">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <header className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row justify-between items-center gap-4 text-center md:text-left">
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-wider text-amber-400">
              CONYSWEETxiSOTOPE SCRIM LEADERBOARD
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Division 1 ({currentD1Count}/16) | Division 2 ({currentD2Count}/20)
            </p>
          </div>
          <div>
            <button
              onClick={handleToggleAdmin}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition border flex items-center gap-2 ${
                isAdmin
                  ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400 shadow-lg shadow-emerald-500/10'
                  : 'bg-slate-950 border-slate-700 text-slate-400 hover:text-slate-200'
              }`}
            >
              {isAdmin ? '🛡️ Admin Mode (On)' : '🔐 เข้าสู่ระบบแอดมิน'}
            </button>
          </div>
        </header>

        {/* Tabs */}
        <div className="flex flex-col md:flex-row gap-3 justify-between items-center">
          <div className="flex gap-2 w-full md:w-auto flex-wrap">
            <button
              onClick={() => setActiveTab('d1')}
              className={`py-3 px-4 rounded-xl font-bold transition text-sm border ${
                activeTab === 'd1'
                  ? 'bg-amber-500/10 border-amber-500 text-amber-400'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              Division 1
            </button>
            <button
              onClick={() => setActiveTab('d2')}
              className={`py-3 px-4 rounded-xl font-bold transition text-sm border ${
                activeTab === 'd2'
                  ? 'bg-amber-500/10 border-amber-500 text-amber-400'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              Division 2
            </button>
            <button
              onClick={() => setActiveTab('halloffame')}
              className={`py-3 px-4 rounded-xl font-bold transition text-sm border ${
                activeTab === 'halloffame'
                  ? 'bg-purple-500/10 border-purple-500 text-purple-400'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              ทำเนียบทีม
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`py-3 px-4 rounded-xl font-bold transition text-sm border ${
                activeTab === 'history'
                  ? 'bg-blue-500/10 border-blue-500 text-blue-400'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              ผลการแข่งย้อนหลัง
            </button>
            {isAdmin && (
              <button
                onClick={() => setActiveTab('match')}
                className={`py-3 px-4 rounded-xl font-bold transition text-sm border ${
                  activeTab === 'match'
                    ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                ➕ กรอกคะแนนทีม (Admin)
              </button>
            )}
          </div>
        </div>

        {/* Admin Panels */}
        {isAdmin && activeTab !== 'history' && activeTab !== 'match' && activeTab !== 'halloffame' && (
          <div className="bg-slate-900 border border-emerald-500/30 rounded-2xl p-5 shadow-xl space-y-4">
            <h3 className="text-sm font-bold text-emerald-400">➕ [Admin] เพิ่มทีมใหม่</h3>
            <form onSubmit={handleAddTeam} className="flex flex-col md:flex-row gap-3">
              <input
                type="text"
                value={newTeamName}
                onChange={(e) => setNewTeamName(e.target.value)}
                placeholder="ชื่อทีม..."
                className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
              />
              <select
                value={newTeamDivision}
                onChange={(e) => setNewTeamDivision(e.target.value as '1' | '2')}
                className="w-full md:w-48 bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-100"
              >
                <option value="2">Division 2</option>
                <option value="1">Division 1</option>
              </select>
              <button type="submit" disabled={processing} className="bg-emerald-500 text-slate-950 font-bold px-6 py-2.5 rounded-xl text-sm">
                บันทึกทีม
              </button>
            </form>
          </div>
        )}

        {isAdmin && activeTab !== 'history' && activeTab !== 'match' && activeTab !== 'halloffame' && (
          <div className="bg-slate-900 border border-emerald-500/30 rounded-2xl p-5 shadow-xl flex flex-col md:flex-row gap-3 items-center">
            <input
              type="text"
              value={seasonNote}
              onChange={(e) => setSeasonNote(e.target.value)}
              placeholder="ระบุชื่อซีซั่น (เช่น Season 1)..."
              className="flex-1 w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-100"
            />
            <button onClick={handleNextSeasonTransition} disabled={processing} className="w-full md:w-auto bg-gradient-to-r from-emerald-500 to-teal-600 text-slate-950 font-bold px-6 py-3 rounded-xl text-sm shadow-lg">
              🏆 จบซีซั่น & สลับโควต้า
            </button>
          </div>
        )}

        {/* Content Section */}
        {activeTab === 'match' && isAdmin ? (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
            <h2 className="text-xl font-bold text-emerald-400 flex items-center gap-2">
              <span>📝</span> บันทึกคะแนนด้วยระบบคำนวณอัตโนมัติ (Admin Only)
            </h2>
            <form onSubmit={handleSaveMatchScore} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">เลือกดิวิชัน</label>
                  <select
                    value={gameDivision}
                    onChange={(e) => { setGameDivision(e.target.value as '1' | '2'); setSelectedTeamId(''); }}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-100"
                  >
                    <option value="1">Division 1</option>
                    <option value="2">Division 2</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">เกมที่</label>
                  <select
                    value={gameNumber}
                    onChange={(e) => setGameNumber(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-100"
                  >
                    {[1, 2, 3, 4, 5, 6].map((num) => (
                      <option key={num} value={num}>เกมที่ {num}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">แผนที่</label>
                  <select
                    value={mapName}
                    onChange={(e) => setMapName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-100"
                  >
                    <option value="Erangel">Erangel</option>
                    <option value="Miramar">Miramar</option>
                    <option value="Rondo">Rondo</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">เลือกทีม</label>
                <select
                  value={selectedTeamId}
                  onChange={(e) => setSelectedTeamId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-100"
                  required
                >
                  <option value="">-- กรุณาเลือกทีม --</option>
                  {allTeams
                    .filter((t) => t.division_id.toString() === gameDivision)
                    .map((team) => (
                      <option key={team.id} value={team.id}>{team.team_name}</option>
                    ))}
                </select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">อันดับที่ได้ (Place 1-16)</label>
                  <input
                    type="number"
                    min="1"
                    max="16"
                    value={teamPlace}
                    onChange={(e) => setTeamPlace(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="เช่น 1, 2, 3..."
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-100"
                    required
                  />
                  <p className="text-[11px] text-amber-400/80 mt-1">
                    👉 แปลงเป็นคะแนนอันดับให้อัตโนมัติ: <span className="font-bold">{calculatedPlacePts} แต้ม</span>
                  </p>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">จำนวนคิล (Kills)</label>
                  <input
                    type="number"
                    min="0"
                    value={teamKills}
                    onChange={(e) => setTeamKills(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="เช่น 5"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-100"
                    required
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    👉 แต้มคิล (1 คิล = 1 แต้ม): <span className="font-bold text-slate-200">{calculatedKillPts} แต้ม</span>
                  </p>
                </div>
              </div>

              {/* ช่องแสดงพรีวิวคะแนนรวมแมตช์นี้แบบเรียลไทม์ */}
              <div className="bg-slate-950 border border-amber-500/30 rounded-xl p-4 flex justify-between items-center">
                <span className="text-sm text-slate-300 font-medium">คะแนนรวมในแมตช์นี้ (คำนวณออโต้):</span>
                <span className="text-lg font-extrabold text-amber-400">{previewTotalMatchPoints} แต้ม</span>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="wwcd"
                  checked={isWWCD}
                  onChange={(e) => setIsWWCD(e.target.checked)}
                  className="w-4 h-4 rounded bg-slate-950 border-slate-700 text-emerald-500"
                />
                <label htmlFor="wwcd" className="text-sm font-semibold text-slate-200 cursor-pointer">
                  ทีมนี้ได้ไก่ (WWCD)
                </label>
              </div>

              <button type="submit" disabled={processing} className="w-full bg-emerald-500 text-slate-950 font-bold py-3 px-6 rounded-xl text-sm">
                💾 บันทึกคะแนนแมตช์นี้
              </button>
            </form>
          </div>
        ) : activeTab === 'halloffame' ? (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2">
              <div>
                <h2 className="text-xl font-bold text-purple-400">ทำเนียบทีม</h2>
                <p className="text-xs text-slate-400 mt-0.5">รวมรายชื่อทีมที่เคยเข้าร่วมแข่งขันทั้งหมด ป้องกันชื่อตกหล่นเวลารับสมัคร OpenChat</p>
              </div>
              <div className="text-xs bg-purple-500/10 border border-purple-500/30 text-purple-300 px-3 py-1.5 rounded-xl font-semibold">
                รวมทั้งหมด {hallOfFameData.length} ทีม
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {hallOfFameData.length > 0 ? (
                hallOfFameData.map((item, idx) => (
                  <div 
                    key={idx}
                    onClick={() => handleOpenTeamHistoryModal(item.team_name)}
                    className="bg-slate-950 border border-slate-800/80 hover:border-purple-500/50 rounded-xl p-4 cursor-pointer transition shadow-md flex flex-col justify-between space-y-2 group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-100 group-hover:text-purple-400 transition text-base">
                        {item.team_name}
                      </span>
                      <span className="text-xs text-slate-500">#{idx + 1}</span>
                    </div>
                    <div className="flex flex-wrap gap-1 pt-1 border-t border-slate-900">
                      {item.seasons.map((sName: string, sIdx: number) => (
                        <span key={sIdx} className="text-[10px] bg-slate-900 text-slate-300 border border-slate-800 px-2 py-0.5 rounded-md font-medium">
                          {sName}
                        </span>
                      ))}
                    </div>
                  </div>
                ))
              ) : (
                <div className="col-span-full text-center py-12 text-slate-500">
                  ยังไม่มีประวัติซีซั่นในระบบ ทำเนียบทีมจะแสดงขึ้นมาเมื่อมีการกดจบซีซั่นแรก
                </div>
              )}
            </div>
          </div>
        ) : activeTab === 'history' ? (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
            <h2 className="text-xl font-bold text-blue-400">ผลการแข่งย้อนหลัง</h2>
            {historySeasons.length > 0 ? (
              <>
                <div className="flex gap-2 flex-wrap">
                  {historySeasons.map((season) => (
                    <button
                      key={season.id}
                      onClick={() => setSelectedSeason(season)}
                      className={`px-4 py-2 rounded-lg font-semibold text-sm border ${selectedSeason?.id === season.id ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-300'}`}
                    >
                      {season.season_name}
                    </button>
                  ))}
                </div>

                {selectedSeason && (
                  <div className="space-y-8 pt-4 border-t border-slate-800">
                    <h3 className="text-lg font-bold text-amber-400">ซีซั่น: {selectedSeason.season_name}</h3>
                    
                    {/* Division 1 Snapshot */}
                    <div className="space-y-3">
                      <h4 className="text-sm font-bold text-amber-400">Division 1 (Snapshot)</h4>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                          <thead>
                            <tr className="border-b border-slate-800 text-slate-400 text-xs bg-slate-950/40">
                              <th className="py-2 px-3">อันดับ</th>
                              <th className="py-2 px-3">ชื่อทีม</th>
                              <th className="py-2 px-3 text-center">WWCD</th>
                              <th className="py-2 px-3 text-right">คะแนนรวม</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/60">
                            {selectedSeason.d1_snapshot?.map((team: any, i: number) => (
                              <tr key={i} className={i >= 12 ? 'bg-red-950/60' : ''}>
                                <td className="py-2 px-3 font-bold text-amber-400">#{i + 1}</td>
                                <td className="py-2 px-3 text-slate-200">
                                  <button
                                    onClick={() => handleOpenTeamHistoryModal(team.team_name)}
                                    className="hover:text-amber-400 hover:underline decoration-dotted text-left font-semibold"
                                  >
                                    {team.team_name}
                                  </button>
                                  {i >= 12 ? ' 📉' : ''}
                                </td>
                                <td className="py-2 px-3 text-center">{team.wwcd || 0}</td>
                                <td className="py-2 px-3 text-right font-bold text-amber-400">{team.total_points || 0}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-12 text-slate-500">ยังไม่มีประวัติการแข่งขันย้อนหลัง</div>
            )}
          </div>
        ) : (
          /* ตารางคะแนนหลัก Division 1 / Division 2 */
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold text-amber-400">
                {activeTab === 'd1' ? 'Division 1 Leaderboard' : 'Division 2 Leaderboard'}
              </h2>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 text-xs bg-slate-950/40">
                    <th className="py-3 px-4">#</th>
                    <th className="py-3 px-4">ชื่อทีม</th>
                    <th className="py-3 px-4 text-center">WWCD</th>
                    <th className="py-3 px-4 text-center">Placement Pts</th>
                    <th className="py-3 px-4 text-center">Elimination Pts</th>
                    <th className="py-3 px-4 text-right font-bold text-amber-400">Total Points</th>
                    {isAdmin && <th className="py-3 px-4 text-center">จัดการ</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {teams.length > 0 ? (
                    teams.map((team, idx) => (
                      <tr 
                        key={team.id} 
                        className={`hover:bg-slate-800/40 transition ${
                          activeTab === 'd1' && idx >= 12 ? 'bg-red-950/20' : activeTab === 'd2' && idx < 4 ? 'bg-emerald-950/20' : ''
                        }`}
                      >
                        <td className="py-3 px-4 font-bold text-amber-400">#{idx + 1}</td>
                        <td className="py-3 px-4 font-medium text-slate-200">
                          <button
                            onClick={() => handleOpenTeamHistoryModal(team.team_name)}
                            className="hover:text-amber-400 hover:underline decoration-dotted text-left"
                          >
                            {team.team_name}
                          </button>
                          {activeTab === 'd1' && idx >= 12 && <span className="ml-2 text-xs text-red-400 font-semibold">(โซนตกชั้น)</span>}
                          {activeTab === 'd2' && idx < 4 && <span className="ml-2 text-xs text-emerald-400 font-semibold">(โซนเลื่อนชั้น)</span>}
                        </td>
                        <td className="py-3 px-4 text-center font-semibold">{team.wwcd || 0}</td>
                        <td className="py-3 px-4 text-center text-slate-300">{team.place_points || 0}</td>
                        <td className="py-3 px-4 text-center text-slate-300">{team.kill_points || 0}</td>
                        <td className="py-3 px-4 text-right font-extrabold text-amber-400 text-base">{team.total_points || 0}</td>
                        {isAdmin && (
                          <td className="py-3 px-4 text-center">
                            <button
                              onClick={() => handleDeleteTeam(team.id, team.team_name)}
                              className="text-red-400 hover:text-red-300 text-xs font-bold px-2 py-1 rounded bg-red-500/10 border border-red-500/20"
                            >
                              ลบ
                            </button>
                          </td>
                        )}
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={isAdmin ? 7 : 6} className="text-center py-12 text-slate-500">
                        ยังไม่มีข้อมูลทีมในดิวิชันนี้
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Modal ประวัติทีมย้อนหลัง */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex justify-center items-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-lg w-full space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-amber-400">ประวัติการแข่งขัน: {modalTeamName}</h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-200 font-bold px-2 py-1 bg-slate-800 rounded-lg text-xs"
              >
                ✕ ปิด
              </button>
            </div>

            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
              {modalLoading ? (
                <div className="text-center py-8 text-slate-500">กำลังโหลดข้อมูล...</div>
              ) : teamHistoryResult.length > 0 ? (
                teamHistoryResult.map((res, i) => (
                  <div key={i} className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex justify-between items-center text-sm">
                    <div>
                      <div className="font-bold text-slate-200">{res.season_name}</div>
                      <div className="text-xs text-slate-400">{res.division} • อันดับที่ #{res.rank}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-extrabold text-amber-400">{res.total_points || 0} คะแนน</div>
                      <div className="text-xs text-slate-400">WWCD: {res.wwcd || 0}</div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-slate-500">ไม่พบประวัติการแข่งขันย้อนหลังของทีมนี้</div>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}