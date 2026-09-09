'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from './supabase';

const placementPointsMap: Record<number, number> = {
  1: 10,
  2: 6,
  3: 5,
  4: 4,
  5: 3,
  6: 2,
  7: 1,
  8: 1,
};

export default function ScrimManagementApp() {
  const [activeTab, setActiveTab] = useState<'latestseason' | 'match' | 'dropmap' | 'history' | 'halloffame'>('latestseason');
  const [teamsD1, setTeamsD1] = useState<any[]>([]);
  const [teamsD2, setTeamsD2] = useState<any[]>([]);
  const [allTeams, setAllTeams] = useState<any[]>([]);
  const [matchLogs, setMatchLogs] = useState<any[]>([]);
  const [historySeasons, setHistorySeasons] = useState<any[]>([]);
  const [selectedSeason, setSelectedSeason] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);

  const [isAdmin, setIsAdmin] = useState(false);

  const [dropMapImages, setDropMapImages] = useState<any[]>([]);
  const [selectedDropMatch, setSelectedDropMatch] = useState<number>(1);
  const [selectedDropSeasonId, setSelectedDropSeasonId] = useState<number | null>(null);
  const [uploadMatchNumber, setUploadMatchNumber] = useState<number>(1);
  const [uploadMapName, setUploadMapName] = useState<string>('Erangel');
  const [imageFile, setImageFile] = useState<File | null>(null);

  const [isTeamDetailModalOpen, setIsTeamDetailModalOpen] = useState(false);
  const [selectedTeamDetail, setSelectedTeamDetail] = useState<any>(null);
  const [teamMatchLogs, setTeamMatchLogs] = useState<any[]>([]);

  const [isHistoryTeamModalOpen, setIsHistoryTeamModalOpen] = useState(false);
  const [selectedHistoryTeam, setSelectedHistoryTeam] = useState<any>(null);
  const [historyTeamDivisionName, setHistoryTeamDivisionName] = useState<string>('');
  const [historyTeamMatchLogs, setHistoryTeamMatchLogs] = useState<any[]>([]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalTeamName, setModalTeamName] = useState('');
  const [teamHistoryResult, setTeamHistoryResult] = useState<any[]>([]);
  const [modalLoading, setModalLoading] = useState(false);

  const [hallOfFameData, setHallOfFameData] = useState<any[]>([]);
  const [hallOfFameSearch, setHallOfFameSearch] = useState('');

  const [uploadingLogoTeamName, setUploadingLogoTeamName] = useState<string | null>(null);
  const [teamLogoFile, setTeamLogoFile] = useState<File | null>(null);

  const [gameDivision, setGameDivision] = useState<'1' | '2'>('1');
  const [gameNumber, setGameNumber] = useState('1');
  const [mapName, setMapName] = useState('Erangel');
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [teamPlace, setTeamPlace] = useState<number | ''>('');
  const [teamKills, setTeamKills] = useState<number | ''>('');
  const [isWWCD, setIsWWCD] = useState(false);

  const calculatedPlacePts = typeof teamPlace === 'number' ? (placementPointsMap[teamPlace] || 0) : 0;
  const calculatedKillPts = typeof teamKills === 'number' ? teamKills : 0;
  const previewTotalMatchPoints = teamPlace !== '' ? calculatedPlacePts + calculatedKillPts : 0;

  const [seasonNote, setSeasonNote] = useState('');
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamDivision, setNewTeamDivision] = useState<'1' | '2'>('2');

  const fetchTeamsAndLogs = async () => {
    setLoading(true);
    if (activeTab === 'latestseason') {
      const { data: d1Data, error: errD1 } = await supabase
        .from('teams')
        .select('*')
        .eq('division_id', 1);

      const { data: d2Data, error: errD2 } = await supabase
        .from('teams')
        .select('*')
        .eq('division_id', 2);

      if (!errD1 && d1Data) setTeamsD1(sortLeaderboard(d1Data));
      if (!errD2 && d2Data) setTeamsD2(sortLeaderboard(d2Data));
    } else if (activeTab === 'history') {
      await fetchHistory();
    } else if (activeTab === 'halloffame') {
      await fetchHistory();
      await fetchHallOfFame();
    } else if (activeTab === 'dropmap') {
      await fetchHistory();
      await fetchDropMapImages();
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

  const fetchDropMapImages = async () => {
    const { data, error } = await supabase
      .from('match_map_images')
      .select('*')
      .order('match_number', { ascending: true });

    if (error) {
      console.error('Error fetching drop map images:', error);
    } else if (data) {
      setDropMapImages(data);
    }
  };

  const sortLeaderboard = (teamList: any[]) => {
    return [...teamList].sort((a, b) => {
      if ((b.total_points || 0) !== (a.total_points || 0)) {
        return (b.total_points || 0) - (a.total_points || 0);
      }
      if ((b.wwcd || 0) !== (a.wwcd || 0)) {
        return (b.wwcd || 0) - (a.wwcd || 0);
      }
      if ((b.place_points || 0) !== (a.place_points || 0)) {
        return (b.place_points || 0) - (a.place_points || 0);
      }
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
      if (data.length > 0 && !selectedDropSeasonId) {
        setSelectedDropSeasonId(data[0].id);
      }
    }
  };

  const fetchHallOfFame = async () => {
    const { data: historyData } = await supabase
      .from('season_history')
      .select('*')
      .order('created_at', { ascending: false });

    const { data: teamsData } = await supabase.from('teams').select('*');

    if (!historyData) {
      setHallOfFameData([]);
      return;
    }

    const teamMap: { [key: string]: { 
      team_name: string; 
      seasonsCount: number; 
      d1Titles: number; 
      totalWWCD: number; 
      totalPlacePoints: number;
      totalKillPoints: number;
      totalPointsAllTime: number;
      seasonsList: string[];
      logo_url?: string;
    } } = {};

    historyData.forEach((season) => {
      const seasonName = season.season_name;

      season.d1_snapshot?.forEach((t: any, idx: number) => {
        const name = t.team_name.trim();
        const key = name.toLowerCase();
        if (!teamMap[key]) {
          const foundTeamInDb = teamsData?.find(dbT => dbT.team_name.toLowerCase() === key);
          teamMap[key] = { 
            team_name: name, 
            seasonsCount: 0, 
            d1Titles: 0, 
            totalWWCD: 0, 
            totalPlacePoints: 0,
            totalKillPoints: 0,
            totalPointsAllTime: 0,
            seasonsList: [],
            logo_url: t.logo_url || foundTeamInDb?.logo_url || ''
          };
        }
        if (!teamMap[key].seasonsList.includes(seasonName)) {
          teamMap[key].seasonsList.push(seasonName);
          teamMap[key].seasonsCount += 1;
        }
        if (idx === 0) {
          teamMap[key].d1Titles += 1;
        }
        teamMap[key].totalWWCD += (t.wwcd || 0);
        teamMap[key].totalPlacePoints += (t.place_points || 0);
        teamMap[key].totalKillPoints += (t.kill_points || 0);
        teamMap[key].totalPointsAllTime += (t.total_points || 0);
        if (!teamMap[key].logo_url && t.logo_url) teamMap[key].logo_url = t.logo_url;
      });

      season.d2_snapshot?.forEach((t: any) => {
        const name = t.team_name.trim();
        const key = name.toLowerCase();
        if (!teamMap[key]) {
          const foundTeamInDb = teamsData?.find(dbT => dbT.team_name.toLowerCase() === key);
          teamMap[key] = { 
            team_name: name, 
            seasonsCount: 0, 
            d1Titles: 0, 
            totalWWCD: 0, 
            totalPlacePoints: 0,
            totalKillPoints: 0,
            totalPointsAllTime: 0,
            seasonsList: [],
            logo_url: t.logo_url || foundTeamInDb?.logo_url || ''
          };
        }
        if (!teamMap[key].seasonsList.includes(seasonName)) {
          teamMap[key].seasonsList.push(seasonName);
          teamMap[key].seasonsCount += 1;
        }
        teamMap[key].totalWWCD += (t.wwcd || 0);
        teamMap[key].totalPlacePoints += (t.place_points || 0);
        teamMap[key].totalKillPoints += (t.kill_points || 0);
        teamMap[key].totalPointsAllTime += (t.total_points || 0);
        if (!teamMap[key].logo_url && t.logo_url) teamMap[key].logo_url = t.logo_url;
      });
    });

    teamsData?.forEach((dbT) => {
      const name = dbT.team_name.trim();
      const key = name.toLowerCase();
      if (!teamMap[key]) {
        teamMap[key] = {
          team_name: name,
          seasonsCount: 0,
          d1Titles: 0,
          totalWWCD: dbT.wwcd || 0,
          totalPlacePoints: dbT.place_points || 0,
          totalKillPoints: dbT.kill_points || 0,
          totalPointsAllTime: dbT.total_points || 0,
          seasonsList: ['Current'],
          logo_url: dbT.logo_url || ''
        };
      } else {
        if (dbT.logo_url && !teamMap[key].logo_url) {
          teamMap[key].logo_url = dbT.logo_url;
        }
      }
    });

    const formattedData = Object.values(teamMap).sort((a, b) => {
      if (b.d1Titles !== a.d1Titles) return b.d1Titles - a.d1Titles;
      return b.totalPointsAllTime - a.totalPointsAllTime;
    });

    setHallOfFameData(formattedData);
  };

  useEffect(() => {
    fetchTeamsAndLogs();
  }, [activeTab]);

  useEffect(() => {
    if (selectedTeamId && gameNumber) {
      const existingLog = matchLogs.find(
        (l) =>
          String(l.team_id).trim() === String(selectedTeamId).trim() &&
          String(l.game_number).trim() === String(gameNumber).trim()
      );
      if (existingLog) {
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

  const handleUploadTeamLogo = async (teamName: string) => {
    if (!isAdmin || !teamLogoFile) return;

    setProcessing(true);
    try {
      const fileExt = teamLogoFile.name.split('.').pop();
      const fileName = `team_logo_${teamName.trim()}_${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from('drop-maps')
        .upload(fileName, teamLogoFile);

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from('drop-maps')
        .getPublicUrl(fileName);

      const logoUrl = publicUrlData.publicUrl;

      await supabase
        .from('teams')
        .update({ logo_url: logoUrl })
        .eq('team_name', teamName);

      alert(`✅ อัปโหลดโลโก้ทีม "${teamName}" สำเร็จ!`);
      setTeamLogoFile(null);
      setUploadingLogoTeamName(null);
      await fetchHallOfFame();
    } catch (err: any) {
      console.error('Error uploading team logo:', err);
      alert('เกิดข้อผิดพลาดในการอัปโหลดโลโก้: ' + (err.message || 'โปรดตรวจสอบสิทธิ์ Storage'));
    } finally {
      setProcessing(false);
    }
  };

  const handleOpenTeamDetailModal = (team: any) => {
    setSelectedTeamDetail(team);
    const logs = matchLogs
      .filter((l) => String(l.team_id).trim() === String(team.id).trim())
      .sort((a, b) => a.game_number - b.game_number);
    setTeamMatchLogs(logs);
    setIsTeamDetailModalOpen(true);
  };

  const handleOpenHistoryTeamModal = (team: any, divisionName: string) => {
    setSelectedHistoryTeam(team);
    setHistoryTeamDivisionName(divisionName);

    if (team.team_match_logs && Array.isArray(team.team_match_logs)) {
      setHistoryTeamMatchLogs(team.team_match_logs);
    } else {
      setHistoryTeamMatchLogs([]);
    }

    setIsHistoryTeamModalOpen(true);
  };

  const handleToggleAdmin = () => {
    if (isAdmin) {
      setIsAdmin(false);
      if (activeTab === 'match') setActiveTab('latestseason');
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

  const handleSaveMatchScore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    if (!selectedTeamId || teamPlace === '') return;

    const placeVal = Number(teamPlace);
    const killsVal = Number(teamKills) || 0;
     
    const pPoints = placementPointsMap[placeVal] || 0;
    const kPoints = killsVal;
    const newMatchTotal = pPoints + kPoints;

    setProcessing(true);
    try {
      const existingLog = matchLogs.find(
        (l) =>
          String(l.team_id).trim() === String(selectedTeamId).trim() &&
          String(l.game_number).trim() === String(gameNumber).trim()
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

  const handleUploadDropMapImage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin || !imageFile) {
      alert('กรุณาเลือกไฟล์รูปภาพ');
      return;
    }

    setProcessing(true);
    try {
      const fileExt = imageFile.name.split('.').pop();
      const fileName = `drop_season_${selectedDropSeasonId}_match_${uploadMatchNumber}_${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('drop-maps')
        .upload(filePath, imageFile);

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from('drop-maps')
        .getPublicUrl(filePath);

      const imageUrl = publicUrlData.publicUrl;

      const { error: dbError } = await supabase
        .from('match_map_images')
        .upsert(
          { 
            season_id: selectedDropSeasonId,
            match_number: uploadMatchNumber, 
            map_name: uploadMapName, 
            image_url: imageUrl,
            updated_at: new Date()
          },
          { onConflict: 'season_id, match_number' }
        );

      if (dbError) throw dbError;

      alert(`✅ อัพโหลดรูป Drop Map ซีซั่นนี้ (แมตช์ที่ ${uploadMatchNumber}) สำเร็จ!`);
      setImageFile(null);
      await fetchDropMapImages();
    } catch (err: any) {
      console.error('Error uploading drop map image:', err);
      alert('เกิดข้อผิดพลาดในการอัพโหลด: ' + (err.message || 'โปรดตรวจสอบสิทธิ์ Storage Bucket'));
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
      const { data: currentLogs } = await supabase.from('match_logs').select('*');

      if (!d1Data || !d2Data) return;

      const mapLogsToTeam = (teamList: any[]) => {
        return sortLeaderboard(teamList).map((team) => {
          const tLogs = (currentLogs || [])
            .filter((l) => String(l.team_id).trim() === String(team.id).trim())
            .sort((a, b) => a.game_number - b.game_number);
          return {
            ...team,
            team_match_logs: tLogs,
          };
        });
      };

      const d1Full = mapLogsToTeam(d1Data).slice(0, 16);
      const d2Full = mapLogsToTeam(d2Data).slice(0, 20);

      const { error: insertErr } = await supabase.from('season_history').insert([
        { season_name: seasonNote, d1_snapshot: d1Full, d2_snapshot: d2Full },
      ]);

      if (insertErr) {
        alert('❌ เกิดข้อผิดพลาดในการบันทึกซีซั่น: ' + insertErr.message);
        setProcessing(false);
        return;
      }

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
      alert(`จบซีซั่นเรียบร้อย บันทึกข้อมูลลงซีซั่นสำเร็จ!`);
      setSeasonNote('');
      fetchTeamsAndLogs();
    } catch (err: any) {
      console.error(err);
      alert('เกิดข้อผิดพลาด: ' + (err.message || 'โปรดลองใหม่อีกครั้ง'));
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

        {/* Tabs - สลับที่ระหว่างซีซั่นทั้งหมด กับ Drop Map เรียบร้อย */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:flex lg:flex-wrap gap-2 w-full">
          <button
            onClick={() => setActiveTab('latestseason')}
            className={`py-3 px-4 rounded-xl font-bold transition text-sm border flex-1 text-center ${
              activeTab === 'latestseason'
                ? 'bg-amber-500/10 border-amber-500 text-amber-400'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            🔥 ซีซั่นล่าสุด (D1 & D2)
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`py-3 px-4 rounded-xl font-bold transition text-sm border flex-1 text-center ${
              activeTab === 'history'
                ? 'bg-blue-500/10 border-blue-400 text-blue-400'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            ซีซั่นทั้งหมด
          </button>
          <button
            onClick={() => setActiveTab('halloffame')}
            className={`py-3 px-4 rounded-xl font-bold transition text-sm border flex-1 text-center ${
              activeTab === 'halloffame'
                ? 'bg-purple-500/10 border-purple-500 text-purple-400'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            Hall of Fame
          </button>
          <button
            onClick={() => setActiveTab('dropmap')}
            className={`py-3 px-4 rounded-xl font-bold transition text-sm border flex-1 text-center ${
              activeTab === 'dropmap'
                ? 'bg-sky-500/10 border-sky-500 text-sky-400'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            🗺️ Drop Map
          </button>
          {isAdmin && (
            <button
              onClick={() => setActiveTab('match')}
              className={`py-3 px-4 rounded-xl font-bold transition text-sm border flex-1 text-center col-span-2 sm:col-span-1 ${
                activeTab === 'match'
                  ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              ➕ กรอกคะแนน (Admin)
            </button>
          )}
        </div>

        {/* Admin Panels */}
        {isAdmin && activeTab !== 'history' && activeTab !== 'latestseason' && activeTab !== 'match' && activeTab !== 'dropmap' && activeTab !== 'halloffame' && (
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

        {isAdmin && activeTab !== 'history' && activeTab !== 'latestseason' && activeTab !== 'match' && activeTab !== 'dropmap' && activeTab !== 'halloffame' && (
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
        ) : activeTab === 'dropmap' ? (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h2 className="text-xl font-bold text-sky-400">🗺️ Drop Map แผนผังจุดลงแข่งขัน</h2>
                <p className="text-xs text-slate-400 mt-0.5">เลือกซีซั่นและเลือกเกมที่ต้องการดูจุดลงของแต่ละทีม</p>
              </div>

              <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 font-semibold">ซีซั่น:</span>
                  <select
                    value={selectedDropSeasonId || ''}
                    onChange={(e) => setSelectedDropSeasonId(Number(e.target.value))}
                    className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 font-bold focus:border-sky-500 focus:outline-none"
                  >
                    {historySeasons.map((season) => (
                      <option key={season.id} value={season.id}>
                        {season.season_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 font-semibold">เลือกเกม:</span>
                  <select
                    value={selectedDropMatch}
                    onChange={(e) => setSelectedDropMatch(Number(e.target.value))}
                    className="bg-slate-950 border border-sky-500/50 rounded-xl px-3 py-2 text-xs text-sky-300 font-bold focus:border-sky-500 focus:outline-none shadow-sm"
                  >
                    {[1, 2, 3, 4, 5, 6].map((matchNum) => (
                      <option key={matchNum} value={matchNum}>
                        เกมที่ {matchNum}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col items-center justify-center min-h-[400px]">
              {(() => {
                const currentImg = dropMapImages.find(
                  (img) => img.match_number === selectedDropMatch && img.season_id === selectedDropSeasonId
                );
                if (currentImg) {
                  return (
                    <div className="w-full space-y-3 text-center">
                      <div className="flex justify-between items-center px-2">
                        <span className="text-sm font-bold text-sky-300">
                          เกมที่ {currentImg.match_number} ({currentImg.map_name || 'Erangel'})
                        </span>
                        <span className="text-xs text-slate-500">
                          อัปเดตล่าสุด: {new Date(currentImg.updated_at || Date.now()).toLocaleTimeString()}
                        </span>
                      </div>
                      <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900 shadow-2xl flex justify-center">
                        <img
                          src={currentImg.image_url}
                          alt={`Drop Map Match ${selectedDropMatch}`}
                          className="max-h-[600px] w-auto object-contain transition-transform hover:scale-105 duration-300"
                        />
                      </div>
                    </div>
                  );
                } else {
                  return (
                    <div className="text-center py-16 space-y-3">
                      <span className="text-4xl">🗺️</span>
                      <p className="text-slate-400 text-sm">ยังไม่มีการอัปโหลดรูปภาพ Drop Map สำหรับเกมที่ {selectedDropMatch} ในซีซั่นนี้</p>
                      {isAdmin && (
                        <p className="text-xs text-emerald-400">💡 แอดมินสามารถเลื่อนลงไปด้านล่างเพื่ออัปโหลดรูปภาพได้เลยครับ</p>
                      )}
                    </div>
                  );
                }
              })()}
            </div>

            {isAdmin && (
              <div className="bg-slate-950 border border-sky-500/30 rounded-xl p-5 space-y-4">
                <h3 className="text-sm font-bold text-sky-400">📤 [Admin] อัปโหลด / จัดการรูปภาพ Drop Map (ตามซีซั่นที่เลือก)</h3>
                
                <form onSubmit={handleUploadDropMapImage} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">เลือกเกมที่ต้องการอัปโหลด</label>
                    <select
                      value={uploadMatchNumber}
                      onChange={(e) => setUploadMatchNumber(Number(e.target.value))}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-100"
                    >
                      {[1, 2, 3, 4, 5, 6].map((num) => (
                        <option key={num} value={num}>เกมที่ {num}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">ชื่อแผนที่</label>
                    <select
                      value={uploadMapName}
                      onChange={(e) => setUploadMapName(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-100"
                    >
                      <option value="Erangel">Erangel</option>
                      <option value="Miramar">Miramar</option>
                      <option value="Rondo">Rondo</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">ไฟล์รูปภาพ (Canva)</label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => setImageFile(e.target.files ? e.target.files[0] : null)}
                      className="w-full text-xs text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-sky-500 file:text-slate-950 hover:file:bg-sky-400 cursor-pointer"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={processing || !imageFile}
                    className="w-full bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold py-2.5 px-6 rounded-xl text-sm transition disabled:opacity-50"
                  >
                    {processing ? 'กำลังอัปโหลด...' : '💾 อัปโหลดรูปแผนที่'}
                  </button>
                </form>
              </div>
            )}
          </div>
        ) : activeTab === 'halloffame' ? (
          /* Hall of Fame ภาพรวม พร้อมช่องค้นหาและปุ่มอัปโหลดโลโก้ทีม */
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h2 className="text-xl font-bold text-purple-400">🏛️ Hall of Fame</h2>
                <p className="text-xs text-slate-400 mt-0.5">รายชื่อทีมทั้งหมด พร้อมโลโก้สัญลักษณ์, สถิติแชมป์ D1, ไก่รวม และแต้มตลอดกาล</p>
              </div>

              <div className="w-full md:w-72">
                <input
                  type="text"
                  value={hallOfFameSearch}
                  onChange={(e) => setHallOfFameSearch(e.target.value)}
                  placeholder="🔍 พิมพ์ชื่อทีมเพื่อค้นหาอันดับ..."
                  className="w-full bg-slate-950 border border-purple-500/40 rounded-xl px-4 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-purple-400 shadow-sm"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {hallOfFameData
                .filter((team) => team.team_name.toLowerCase().includes(hallOfFameSearch.toLowerCase()))
                .map((team, idx) => {
                  const realRank = hallOfFameData.findIndex((t) => t.team_name === team.team_name) + 1;
                  return (
                    <div
                      key={idx}
                      className="bg-slate-950 border border-slate-800 hover:border-purple-500/50 rounded-xl p-4 transition shadow-md flex flex-col justify-between gap-4 group"
                    >
                      {/* ส่วนหัวการ์ด: โลโก้ + ชื่อทีม + อันดับ */}
                      <div className="flex items-center justify-between">
                        <div 
                          onClick={() => handleOpenHistoryTeamModal(team, 'Hall of Fame')}
                          className="flex items-center gap-3.5 cursor-pointer flex-1 min-w-0"
                        >
                          <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-700/60 flex items-center justify-center overflow-hidden shrink-0 shadow-md">
                            {team.logo_url ? (
                              <img src={team.logo_url} alt={team.team_name} className="w-full h-full object-cover" />
                            ) : (
                              <span className="text-xl font-extrabold text-purple-400">{team.team_name.charAt(0)}</span>
                            )}
                          </div>
                          <div className="min-w-0">
                            <span className="text-xs text-purple-400 font-bold">#{realRank}</span>
                            <h3 className="font-bold text-slate-100 group-hover:text-purple-300 transition text-base truncate mt-0.5">
                              {team.team_name}
                            </h3>
                          </div>
                        </div>

                        {team.d1Titles > 0 ? (
                          <span className="text-[11px] bg-amber-500/10 border border-amber-500/30 text-amber-400 px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 shrink-0">
                            🏆 {team.d1Titles} แชมป์
                          </span>
                        ) : (
                          <span className="text-[11px] bg-purple-500/10 border border-purple-500/30 text-purple-400 px-2.5 py-1 rounded-lg shrink-0">
                            {team.seasonsCount} ซีซั่น
                          </span>
                        )}
                      </div>

                      {/* สถิติต่างๆ */}
                      <div 
                        onClick={() => handleOpenHistoryTeamModal(team, 'Hall of Fame')}
                        className="grid grid-cols-2 gap-2 bg-slate-900/60 border border-slate-800/80 rounded-lg p-2 text-center text-xs cursor-pointer"
                      >
                        <div>
                          <div className="text-slate-400 text-[10px]">ไก่รวม (WWCD)</div>
                          <div className="font-extrabold text-amber-400">{team.totalWWCD}</div>
                        </div>
                        <div>
                          <div className="text-slate-400 text-[10px]">แต้มรวมตลอดกาล</div>
                          <div className="font-extrabold text-amber-400">{team.totalPointsAllTime}</div>
                        </div>
                        <div>
                          <div className="text-slate-400 text-[10px]">แต้มอันดับสะสม</div>
                          <div className="font-bold text-slate-300">{team.totalPlacePoints}</div>
                        </div>
                        <div>
                          <div className="text-slate-400 text-[10px]">แต้มคิลสะสม</div>
                          <div className="font-bold text-slate-300">{team.totalKillPoints}</div>
                        </div>
                      </div>

                      {/* รายชื่อซีซั่น และปุ่มจัดการโลโก้สำหรับแอดมิน */}
                      <div className="flex flex-col gap-2 pt-1 border-t border-slate-900">
                        <div className="text-[11px] text-slate-400 truncate">
                          <span className="text-slate-500">ซีซั่น:</span> {team.seasonsList.join(', ')}
                        </div>

                        {isAdmin && (
                          <div className="flex items-center justify-between pt-1">
                            {uploadingLogoTeamName === team.team_name ? (
                              <div className="flex items-center gap-2 w-full">
                                <input
                                  type="file"
                                  accept="image/*"
                                  onChange={(e) => setTeamLogoFile(e.target.files ? e.target.files[0] : null)}
                                  className="text-[10px] text-slate-400 file:mr-2 file:py-1 file:px-2 file:rounded-lg file:border-0 file:text-[10px] file:font-bold file:bg-purple-500 file:text-slate-950 cursor-pointer w-full"
                                />
                                <button
                                  onClick={() => handleUploadTeamLogo(team.team_name)}
                                  disabled={!teamLogoFile || processing}
                                  className="bg-emerald-500 text-slate-950 font-bold px-3 py-1 rounded-lg text-[10px] shrink-0"
                                >
                                  บันทึก
                                </button>
                                <button
                                  onClick={() => { setUploadingLogoTeamName(null); setTeamLogoFile(null); }}
                                  className="bg-slate-800 text-slate-300 px-2 py-1 rounded-lg text-[10px] shrink-0"
                                >
                                  ยกเลิก
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setUploadingLogoTeamName(team.team_name)}
                                className="text-xs text-purple-400 hover:text-purple-300 font-semibold flex items-center justify-center gap-1.5 bg-purple-500/10 border border-purple-500/30 py-2 rounded-xl transition w-full"
                              >
                                🖼️ {team.logo_url ? 'เปลี่ยนโลโก้ทีม' : '➕ อัปโหลดโลโก้ทีม'}
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              {hallOfFameData.filter((team) => team.team_name.toLowerCase().includes(hallOfFameSearch.toLowerCase())).length === 0 && (
                <div className="col-span-full text-center py-12 text-slate-500 text-sm">
                  ไม่พบทีมที่คุณค้นหาใน Hall of Fame
                </div>
              )}
            </div>
          </div>
        ) : activeTab === 'latestseason' ? (
          /* หน้าซีซั่นล่าสุด รวมตารางคะแนนปัจจุบันของ Division 1 และ Division 2 ไว้ในหน้าเดียว */
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Division 1 Leaderboard */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
                <h2 className="text-xl font-bold text-amber-400 flex items-center justify-between">
                  <span>🏆 Division 1 Leaderboard</span>
                  <span className="text-xs font-normal text-slate-400">({teamsD1.length}/16 ทีม)</span>
                </h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 text-xs">
                        <th className="py-3 px-2">อันดับ</th>
                        <th className="py-3 px-2">ชื่อทีม</th>
                        <th className="py-3 px-2 text-center">WWCD</th>
                        <th className="py-3 px-2 text-center">แต้มอันดับ</th>
                        <th className="py-3 px-2 text-center">แต้มคิล</th>
                        <th className="py-3 px-2 text-right">แต้มรวม</th>
                        {isAdmin && <th className="py-3 px-2 text-center">จัดการ</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {teamsD1.map((team, idx) => (
                        <tr
                          key={team.id}
                          className="border-b border-slate-800/50 hover:bg-slate-800/30 transition cursor-pointer"
                          onClick={() => handleOpenTeamDetailModal(team)}
                        >
                          <td className="py-3 px-2 font-bold">
                            {idx === 0 ? '🥇 1' : idx === 1 ? '🥈 2' : idx === 2 ? '🥉 3' : idx + 1}
                          </td>
                          <td className="py-3 px-2 font-semibold text-slate-200">{team.team_name}</td>
                          <td className="py-3 px-2 text-center text-amber-400 font-bold">{team.wwcd || 0}</td>
                          <td className="py-3 px-2 text-center text-slate-300">{team.place_points || 0}</td>
                          <td className="py-3 px-2 text-center text-slate-300">{team.kill_points || 0}</td>
                          <td className="py-3 px-2 text-right font-extrabold text-amber-400 text-base">{team.total_points || 0}</td>
                          {isAdmin && (
                            <td className="py-3 px-2 text-center" onClick={(e) => e.stopPropagation()}>
                              <button
                                onClick={() => handleDeleteTeam(team.id, team.team_name)}
                                className="bg-rose-500/10 border border-rose-500/30 text-rose-400 hover:bg-rose-500 hover:text-slate-950 px-2 py-1 rounded-lg text-xs font-bold transition"
                              >
                                ลบ
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                      {teamsD1.length === 0 && (
                        <tr>
                          <td colSpan={isAdmin ? 7 : 6} className="text-center py-8 text-slate-500 text-xs">
                            ยังไม่มีข้อมูลทีมใน Division 1
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Division 2 Leaderboard */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
                <h2 className="text-xl font-bold text-slate-300 flex items-center justify-between">
                  <span>🥈 Division 2 Leaderboard</span>
                  <span className="text-xs font-normal text-slate-400">({teamsD2.length}/20 ทีม)</span>
                </h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 text-xs">
                        <th className="py-3 px-2">อันดับ</th>
                        <th className="py-3 px-2">ชื่อทีม</th>
                        <th className="py-3 px-2 text-center">WWCD</th>
                        <th className="py-3 px-2 text-center">แต้มอันดับ</th>
                        <th className="py-3 px-2 text-center">แต้มคิล</th>
                        <th className="py-3 px-2 text-right">แต้มรวม</th>
                        {isAdmin && <th className="py-3 px-2 text-center">จัดการ</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {teamsD2.map((team, idx) => (
                        <tr
                          key={team.id}
                          className="border-b border-slate-800/50 hover:bg-slate-800/30 transition cursor-pointer"
                          onClick={() => handleOpenTeamDetailModal(team)}
                        >
                          <td className="py-3 px-2 font-bold text-slate-400">{idx + 1}</td>
                          <td className="py-3 px-2 font-semibold text-slate-200">{team.team_name}</td>
                          <td className="py-3 px-2 text-center text-slate-400 font-bold">{team.wwcd || 0}</td>
                          <td className="py-3 px-2 text-center text-slate-300">{team.place_points || 0}</td>
                          <td className="py-3 px-2 text-center text-slate-300">{team.kill_points || 0}</td>
                          <td className="py-3 px-2 text-right font-extrabold text-slate-200 text-base">{team.total_points || 0}</td>
                          {isAdmin && (
                            <td className="py-3 px-2 text-center" onClick={(e) => e.stopPropagation()}>
                              <button
                                onClick={() => handleDeleteTeam(team.id, team.team_name)}
                                className="bg-rose-500/10 border border-rose-500/30 text-rose-400 hover:bg-rose-500 hover:text-slate-950 px-2 py-1 rounded-lg text-xs font-bold transition"
                              >
                                ลบ
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                      {teamsD2.length === 0 && (
                        <tr>
                          <td colSpan={isAdmin ? 7 : 6} className="text-center py-8 text-slate-500 text-xs">
                            ยังไม่มีข้อมูลทีมใน Division 2
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        ) : activeTab === 'history' ? (
          /* หน้าซีซั่นทั้งหมด (สำหรับดูประวัติย้อนหลัง) */
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h2 className="text-xl font-bold text-blue-400">📜 ซีซั่นทั้งหมด</h2>
                <p className="text-xs text-slate-400 mt-0.5">เลือกซีซั่น และคลิกที่ชื่อทีมเพื่อดูคะแนนแยกย่อยรายเกมในซีซั่นนั้นๆ</p>
              </div>

              <div className="flex items-center gap-2 w-full md:w-auto">
                <span className="text-xs text-slate-400 font-semibold">เลือกซีซั่น:</span>
                <select
                  value={selectedSeason?.id || ''}
                  onChange={(e) => {
                    const found = historySeasons.find((s) => s.id === Number(e.target.value));
                    if (found) setSelectedSeason(found);
                  }}
                  className="bg-slate-950 border border-blue-500/50 rounded-xl px-4 py-2 text-xs text-blue-300 font-bold focus:border-blue-500 focus:outline-none shadow-sm w-full md:w-48"
                >
                  {historySeasons.map((season) => (
                    <option key={season.id} value={season.id}>
                      {season.season_name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {selectedSeason ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
                  <h3 className="font-bold text-amber-400 text-sm">🏆 Division 1 ({selectedSeason.season_name})</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-800 text-slate-400">
                          <th className="py-2 px-2">#</th>
                          <th className="py-2 px-2">ทีม (คลิกเพื่อดูแต้มรายเกม)</th>
                          <th className="py-2 px-2 text-center">WWCD</th>
                          <th className="py-2 px-2 text-center">แต้มอันดับ</th>
                          <th className="py-2 px-2 text-center">แต้มคิล</th>
                          <th className="py-2 px-2 text-right">แต้มรวม</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedSeason.d1_snapshot?.map((t: any, idx: number) => (
                          <tr 
                            key={idx} 
                            onClick={() => handleOpenHistoryTeamModal(t, 'Division 1')}
                            className="border-b border-slate-900/50 hover:bg-slate-900/80 cursor-pointer transition"
                            title="คลิกเพื่อดูแต้มรายเกม"
                          >
                            <td className="py-2 px-2 font-bold text-slate-400">{idx + 1}</td>
                            <td className="py-2 px-2 font-semibold text-blue-300 hover:underline flex items-center gap-1.5">
                              <span>{t.team_name}</span>
                              <span className="text-[10px] text-slate-500">📊</span>
                            </td>
                            <td className="py-2 px-2 text-center text-amber-400">{t.wwcd || 0}</td>
                            <td className="py-2 px-2 text-center text-slate-300">{t.place_points || 0}</td>
                            <td className="py-2 px-2 text-center text-slate-300">{t.kill_points || 0}</td>
                            <td className="py-2 px-2 text-right font-bold text-amber-400">{t.total_points || 0}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
                  <h3 className="font-bold text-slate-300 text-sm">🥈 Division 2 ({selectedSeason.season_name})</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-800 text-slate-400">
                          <th className="py-2 px-2">#</th>
                          <th className="py-2 px-2">ทีม (คลิกเพื่อดูแต้มรายเกม)</th>
                          <th className="py-2 px-2 text-center">WWCD</th>
                          <th className="py-2 px-2 text-center">แต้มอันดับ</th>
                          <th className="py-2 px-2 text-center">แต้มคิล</th>
                          <th className="py-2 px-2 text-right">แต้มรวม</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedSeason.d2_snapshot?.map((t: any, idx: number) => (
                          <tr 
                            key={idx} 
                            onClick={() => handleOpenHistoryTeamModal(t, 'Division 2')}
                            className="border-b border-slate-900/50 hover:bg-slate-900/80 cursor-pointer transition"
                            title="คลิกเพื่อดูแต้มรายเกม"
                          >
                            <td className="py-2 px-2 font-bold text-slate-400">{idx + 1}</td>
                            <td className="py-2 px-2 font-semibold text-blue-300 hover:underline flex items-center gap-1.5">
                              <span>{t.team_name}</span>
                              <span className="text-[10px] text-slate-500">📊</span>
                            </td>
                            <td className="py-2 px-2 text-center text-slate-400">{t.wwcd || 0}</td>
                            <td className="py-2 px-2 text-center text-slate-300">{t.place_points || 0}</td>
                            <td className="py-2 px-2 text-center text-slate-300">{t.kill_points || 0}</td>
                            <td className="py-2 px-2 text-right font-bold text-slate-200">{t.total_points || 0}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-center text-slate-500 py-10">ยังไม่มีข้อมูลประวัติซีซั่น</p>
            )}
          </div>
        ) : null}

        {/* Modal รายละเอียดแต้มรายแมตช์ของทีมปัจจุบัน */}
        {isTeamDetailModalOpen && selectedTeamDetail && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex justify-center items-center p-4 z-50">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-bold text-amber-400">📊 สถิติรายแมตช์: {selectedTeamDetail.team_name}</h3>
                <button
                  onClick={() => setIsTeamDetailModalOpen(false)}
                  className="text-slate-400 hover:text-slate-100 font-bold"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
                {teamMatchLogs.length > 0 ? (
                  teamMatchLogs.map((log) => (
                    <div key={log.id} className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex justify-between items-center text-xs">
                      <div>
                        <span className="font-bold text-sky-400">แมตช์ {log.game_number}</span>
                        <span className="text-slate-400 ml-2">({log.map_name || 'Erangel'})</span>
                        {log.wwcd === 1 && <span className="ml-2 bg-amber-500/10 border border-amber-500/30 text-amber-400 px-1.5 py-0.5 rounded">🍗 WWCD</span>}
                      </div>
                      <div className="text-right space-x-3">
                        <span className="text-slate-400">อันดับ {log.place} ({log.place_points} แต้ม)</span>
                        <span className="text-slate-300">คิล {log.kill_points}</span>
                        <span className="font-bold text-amber-400">รวม {(log.place_points || 0) + (log.kill_points || 0)} แต้ม</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-center text-slate-500 py-6 text-xs">ยังไม่มีประวัติการบันทึกคะแนนรายแมตช์ของทีมนี้</p>
                )}
              </div>

              <button
                onClick={() => setIsTeamDetailModalOpen(false)}
                className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold py-2.5 rounded-xl text-xs transition"
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        )}

        {/* 📜 Modal รายละเอียดแต้มรายเกมย้อนหลัง */}
        {isHistoryTeamModalOpen && selectedHistoryTeam && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex justify-center items-center p-4 z-50">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-bold text-blue-400">📊 ผลงานรายเกมย้อนหลัง: {selectedHistoryTeam.team_name}</h3>
                  <p className="text-xs text-slate-400">{historyTeamDivisionName}</p>
                </div>
                <button
                  onClick={() => setIsHistoryTeamModalOpen(false)}
                  className="text-slate-400 hover:text-slate-100 font-bold"
                >
                  ✕
                </button>
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs flex justify-between items-center">
                <span className="text-slate-400">สรุปภาพรวม:</span>
                <div className="space-x-2">
                  <span className="text-amber-400">🍗 WWCD: {selectedHistoryTeam.wwcd || 0}</span>
                  <span className="text-slate-300">อันดับ: {selectedHistoryTeam.place_points || 0}</span>
                  <span className="text-slate-300">คิล: {selectedHistoryTeam.kill_points || 0}</span>
                  <span className="font-bold text-amber-400">รวม: {selectedHistoryTeam.total_points || 0} แต้ม</span>
                </div>
              </div>

              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                {historyTeamMatchLogs.length > 0 ? (
                  historyTeamMatchLogs.map((log: any, i: number) => (
                    <div key={i} className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex justify-between items-center text-xs">
                      <div>
                        <span className="font-bold text-blue-400">เกมที่ {log.game_number}</span>
                        <span className="text-slate-400 ml-2">({log.map_name || 'Erangel'})</span>
                        {log.wwcd === 1 && <span className="ml-2 bg-amber-500/10 border border-amber-500/30 text-amber-400 px-1.5 py-0.5 rounded">🍗 WWCD</span>}
                      </div>
                      <div className="text-right space-x-2">
                        <span className="text-slate-400">อันดับ {log.place} ({log.place_points} แต้ม)</span>
                        <span className="text-slate-300">คิล {log.kill_points}</span>
                        <span className="font-bold text-amber-400">รวม {(log.place_points || 0) + (log.kill_points || 0)} แต้ม</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-center text-slate-500 py-8 text-xs">ไม่พบประวัติรายเกมแยกย่อยของทีมนี้ในซีซั่นดังกล่าว</p>
                )}
              </div>

              <button
                onClick={() => setIsHistoryTeamModalOpen(false)}
                className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold py-2.5 rounded-xl text-xs transition"
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}