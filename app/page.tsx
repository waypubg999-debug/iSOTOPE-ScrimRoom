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
  const [activeTab, setActiveTab] = useState<'latestseason' | 'match' | 'dropmap' | 'history' | 'halloffame' | 'teams'>('latestseason');
  const [showcaseSubTab, setShowcaseSubTab] = useState<'D1' | 'D2'>('D1');

  const [teamsD1, setTeamsD1] = useState<any[]>([]);
  const [teamsD2, setTeamsD2] = useState<any[]>([]);
  const [allTeams, setAllTeams] = useState<any[]>([]);
  const [matchLogs, setMatchLogs] = useState<any[]>([]);
  const [historySeasons, setHistorySeasons] = useState<any[]>([]);
  const [selectedSeason, setSelectedSeason] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);

  const [isAdmin, setIsAdmin] = useState(false);
  const [adminMenu, setAdminMenu] = useState<'logo' | 'team' | 'season' | 'bg' | null>(null);

  const [bgImageFile, setBgImageFile] = useState<File | null>(null);
  const [currentBgUrl, setCurrentBgUrl] = useState<string>('');

  const [dropMapImages, setDropMapImages] = useState<any[]>([]);
  const [selectedDropMatch, setSelectedDropMatch] = useState<number>(1);
  const [selectedDropSeasonId, setSelectedDropSeasonId] = useState<number | null>(null);

  const [selectedTeamForLogo, setSelectedTeamForLogo] = useState<string>('');
  const [teamLogoFile, setTeamLogoFile] = useState<File | null>(null);

  const [isTeamDetailModalOpen, setIsTeamDetailModalOpen] = useState(false);
  const [selectedTeamDetail, setSelectedTeamDetail] = useState<any>(null);
  const [teamMatchLogs, setTeamMatchLogs] = useState<any[]>([]);

  const [isHistoryTeamModalOpen, setIsHistoryTeamModalOpen] = useState(false);
  const [selectedHistoryTeam, setSelectedHistoryTeam] = useState<any>(null);
  const [historyTeamDivisionName, setHistoryTeamDivisionName] = useState<string>('');
  const [historyTeamSeasonRecords, setHistoryTeamSeasonRecords] = useState<any[]>([]);

  const [hallOfFameData, setHallOfFameData] = useState<any[]>([]);
  const [hallOfFameSearch, setHallOfFameSearch] = useState('');

  const [isSwapModalOpen, setIsSwapModalOpen] = useState(false);
  const [swapSourceTeam, setSwapSourceTeam] = useState<any>(null);
  const [swapTargetTeamId, setSwapTargetTeamId] = useState<number | null>(null);

  const [batchGameNumber, setBatchGameNumber] = useState<number>(1);
  const [batchMapName, setBatchMapName] = useState<string>('Erangel');
  const [batchInputs, setBatchInputs] = useState<{ [teamId: string]: { place: string; kills: string; wwcd: boolean } }>({});
  const [batchSearchQuery, setBatchSearchQuery] = useState<string>('');

  const [seasonNote, setSeasonNote] = useState('');
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamDivision, setNewTeamDivision] = useState<'1' | '2'>('2');

  const fetchTeamsAndLogs = async () => {
    setLoading(true);
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

    const { data: allData } = await supabase
      .from('teams')
      .select('*')
      .order('team_name', { ascending: true });
    if (allData) setAllTeams(allData);

    const { data: logsData, error: logErr } = await supabase.from('match_logs').select('*');
    if (logErr) console.error('Error fetching match_logs:', logErr);
    if (logsData) {
      setMatchLogs(logsData);
    }

    const { data: settingData } = await supabase
      .from('app_settings')
      .select('*')
      .eq('key', 'bg_watermark')
      .maybeSingle();

    if (settingData && settingData.value) {
      setCurrentBgUrl(settingData.value);
    }

    if (activeTab === 'history') {
      await fetchHistory();
    } else if (activeTab === 'halloffame' || activeTab === 'teams') {
      await fetchHistory();
      await fetchHallOfFame();
    } else if (activeTab === 'dropmap') {
      await fetchHistory();
      await fetchDropMapImages();
    }

    setLoading(false);
  };

  useEffect(() => {
    if (activeTab === 'match' && allTeams.length > 0) {
      const initialInputs: { [teamId: string]: { place: string; kills: string; wwcd: boolean } } = {};
      allTeams.forEach((team) => {
        const existingLog = matchLogs.find(
          (l) => String(l.team_id).trim() === String(team.id).trim() && Number(l.game_number) === batchGameNumber
        );
        initialInputs[team.id] = {
          place: existingLog ? String(existingLog.place ?? '') : '',
          kills: existingLog ? String(existingLog.kill_points ?? '') : '',
          wwcd: existingLog ? existingLog.wwcd === 1 : false,
        };
        if (existingLog && existingLog.map_name) {
          setBatchMapName(existingLog.map_name);
        }
      });
      setBatchInputs(initialInputs);
    }
  }, [batchGameNumber, activeTab, allTeams, matchLogs]);

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
      if ((b.kill_points || 0) !== (a.kill_points || 0)) {
        return (b.kill_points || 0) - (a.kill_points || 0);
      }

      const nameA = a.team_name || '';
      const nameB = b.team_name || '';
      const isEngA = /^[A-Za-z]/.test(nameA);
      const isEngB = /^[A-Za-z]/.test(nameB);

      if (isEngA && !isEngB) return -1;
      if (!isEngA && isEngB) return 1;

      return nameA.localeCompare(nameB, 'th');
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
      seasonsDetails: any[];
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
            seasonsDetails: [],
            logo_url: t.logo_url || foundTeamInDb?.logo_url || ''
          };
        }
        
        teamMap[key].seasonsDetails.push({
          season_name: seasonName,
          division: 'Division 1',
          rank: idx + 1,
          wwcd: t.wwcd || 0,
          place_points: t.place_points || 0,
          kill_points: t.kill_points || 0,
          total_points: t.total_points || 0
        });

        teamMap[key].seasonsCount += 1;
        if (idx === 0) {
          teamMap[key].d1Titles += 1;
        }
        teamMap[key].totalWWCD += (t.wwcd || 0);
        teamMap[key].totalPlacePoints += (t.place_points || 0);
        teamMap[key].totalKillPoints += (t.kill_points || 0);
        teamMap[key].totalPointsAllTime += (t.total_points || 0);
        if (!teamMap[key].logo_url && t.logo_url) teamMap[key].logo_url = t.logo_url;
      });

      season.d2_snapshot?.forEach((t: any, idx: number) => {
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
            seasonsDetails: [],
            logo_url: t.logo_url || foundTeamInDb?.logo_url || ''
          };
        }

        teamMap[key].seasonsDetails.push({
          season_name: seasonName,
          division: 'Division 2',
          rank: idx + 1,
          wwcd: t.wwcd || 0,
          place_points: t.place_points || 0,
          kill_points: t.kill_points || 0,
          total_points: t.total_points || 0
        });

        teamMap[key].seasonsCount += 1;
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
          seasonsCount: 1,
          d1Titles: 0,
          totalWWCD: dbT.wwcd || 0,
          totalPlacePoints: dbT.place_points || 0,
          totalKillPoints: dbT.kill_points || 0,
          totalPointsAllTime: dbT.total_points || 0,
          seasonsDetails: [{
            season_name: 'Current Season',
            division: `Division ${dbT.division_id}`,
            rank: '-',
            wwcd: dbT.wwcd || 0,
            place_points: dbT.place_points || 0,
            kill_points: dbT.kill_points || 0,
            total_points: dbT.total_points || 0
          }],
          logo_url: dbT.logo_url || ''
        };
      } else {
        if (dbT.logo_url && !teamMap[key].logo_url) {
          teamMap[key].logo_url = dbT.logo_url;
        }
      }
    });

    const formattedData = Object.values(teamMap)
      .filter((team) => team.totalPointsAllTime > 0 || team.totalWWCD > 0 || team.d1Titles > 0 || team.seasonsCount > 0)
      .sort((a, b) => {
        if (b.d1Titles !== a.d1Titles) return b.d1Titles - a.d1Titles;
        if (b.totalPointsAllTime !== a.totalPointsAllTime) return b.totalPointsAllTime - a.totalPointsAllTime;
        return b.totalWWCD - a.totalWWCD;
      });

    setHallOfFameData(formattedData);
  };

  useEffect(() => {
    fetchTeamsAndLogs();
  }, [activeTab]);

  const handleOpenTeamDetailModal = (team: any) => {
    setSelectedTeamDetail(team);
    const logs = matchLogs
      .filter((l) => String(l.team_id).trim() === String(team.id).trim())
      .sort((a, b) => a.game_number - b.game_number);
    setTeamMatchLogs(logs);
    setIsTeamDetailModalOpen(true);
  };

  const handleOpenShowcaseTeamModal = (team: any) => {
    const key = team.team_name.trim().toLowerCase();
    const foundHof = hallOfFameData.find((h) => h.team_name.trim().toLowerCase() === key);
    
    const targetData = foundHof || {
      team_name: team.team_name,
      seasonsCount: 1,
      d1Titles: 0,
      totalWWCD: team.wwcd || 0,
      totalPlacePoints: team.place_points || 0,
      totalKillPoints: team.kill_points || 0,
      totalPointsAllTime: team.total_points || 0,
      seasonsDetails: [{
        season_name: 'Current Season',
        division: `Division ${team.division_id}`,
        rank: '-',
        wwcd: team.wwcd || 0,
        place_points: team.place_points || 0,
        kill_points: team.kill_points || 0,
        total_points: team.total_points || 0
      }],
      logo_url: team.logo_url || ''
    };

    setSelectedHistoryTeam(targetData);
    setHistoryTeamDivisionName(`Division ${team.division_id}`);
    setHistoryTeamSeasonRecords(targetData.seasonsDetails || []);
    
    setIsHistoryTeamModalOpen(true);
  };

  const handleOpenHistoryTeamModal = (team: any, divisionName: string) => {
    setSelectedHistoryTeam(team);
    setHistoryTeamDivisionName(divisionName);

    if (team.seasonsDetails && Array.isArray(team.seasonsDetails)) {
      setHistoryTeamSeasonRecords(team.seasonsDetails);
    } else {
      setHistoryTeamSeasonRecords([{
        season_name: 'Current / Recorded Season',
        division: divisionName,
        rank: '-',
        wwcd: team.wwcd || team.totalWWCD || 0,
        place_points: team.place_points || team.totalPlacePoints || 0,
        kill_points: team.kill_points || team.totalKillPoints || 0,
        total_points: team.total_points || team.totalPointsAllTime || 0
      }]);
    }

    setIsHistoryTeamModalOpen(true);
  };

  const handleToggleAdmin = () => {
    if (isAdmin) {
      setIsAdmin(false);
      setAdminMenu(null);
      if (activeTab === 'match') setActiveTab('latestseason');
      alert('ออกจากระบบแอดมินแล้ว');
    } else {
      const pass = prompt('กรุณากรอกรหัสผ่านแอดมิน:');
      if (pass === 'coachway123') {
        setIsAdmin(true);
        alert('เข้าสู่ระบบแอดมินสำเร็จ!');
      } else if (pass !== null) {
        alert('รหัสผ่านไม่ถูกต้อง');
      }
    }
  };

  const handleOpenSwapModal = (team: any) => {
    setSwapSourceTeam(team);
    setSwapTargetTeamId(null);
    setIsSwapModalOpen(true);
  };

  const handleExecuteSwap = async () => {
    if (!swapSourceTeam || !swapTargetTeamId) {
      alert('กรุณาเลือกทีมที่ต้องการสลับด้วย');
      return;
    }

    const targetTeam = allTeams.find((t) => t.id === Number(swapTargetTeamId));
    if (!targetTeam) return;

    if (
      !confirm(
        `ยืนยันการสลับตำแหน่งสล็อตระหว่าง "${swapSourceTeam.team_name}" (Division ${swapSourceTeam.division_id}) กับ "${targetTeam.team_name}" (Division ${targetTeam.division_id})?`
      )
    )
      return;

    setProcessing(true);
    try {
      const sourceNewDiv = targetTeam.division_id;
      const targetNewDiv = swapSourceTeam.division_id;

      await supabase.from('teams').update({ division_id: sourceNewDiv }).eq('id', swapSourceTeam.id);
      await supabase.from('teams').update({ division_id: targetNewDiv }).eq('id', targetTeam.id);

      alert(`สลับทีมเรียบร้อยแล้ว!`);
      setIsSwapModalOpen(false);
      setSwapSourceTeam(null);
      setSwapTargetTeamId(null);
      await fetchTeamsAndLogs();
    } catch (err: any) {
      console.error(err);
      alert('เกิดข้อผิดพลาดในการสลับทีม: ' + (err.message || ''));
    } finally {
      setProcessing(false);
    }
  };

  const handleAddTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    if (!newTeamName.trim()) return;

    const targetDivision = parseInt(newTeamDivision);
    const currentD1Count = allTeams.filter((t) => t.division_id === 1).length;
    const currentD2Count = allTeams.filter((t) => t.division_id === 2).length;

    if (targetDivision === 1 && currentD1Count >= 16) {
      alert(`Division 1 เต็มแล้ว`);
      return;
    }
    if (targetDivision === 2 && currentD2Count >= 20) {
      alert(`Division 2 เต็มแล้ว`);
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
      alert(`เพิ่มทีมสำเร็จ!`);
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
    if (!confirm(`ยืนยันการลบทีม "${teamName}"?`)) return;

    setProcessing(true);
    try {
      await supabase.from('match_logs').delete().eq('team_id', teamId);
      await supabase.from('teams').delete().eq('id', teamId);
      alert(`ลบทีมเรียบร้อย`);
      await fetchTeamsAndLogs();
    } catch (err) {
      console.error(err);
    } finally {
      setProcessing(false);
    }
  };

  const handleUploadTeamLogo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin || !selectedTeamForLogo || !teamLogoFile) {
      alert('กรุณาเลือกทีมและเลือกไฟล์รูปภาพโลโก้');
      return;
    }

    setProcessing(true);
    try {
      const fileExt = teamLogoFile.name.split('.').pop();
      const fileName = `team_logo_${selectedTeamForLogo}_${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('drop-maps')
        .upload(filePath, teamLogoFile);

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from('drop-maps')
        .getPublicUrl(filePath);

      const logoUrl = publicUrlData.publicUrl;

      const { error: dbError } = await supabase
        .from('teams')
        .update({ logo_url: logoUrl })
        .eq('id', Number(selectedTeamForLogo));

      if (dbError) throw dbError;

      alert(`อัปโหลดโลโก้ทีมสำเร็จ!`);
      setTeamLogoFile(null);
      setSelectedTeamForLogo('');
      await fetchTeamsAndLogs();
    } catch (err: any) {
      console.error('Error uploading team logo:', err);
      alert('เกิดข้อผิดพลาดในการอัปโหลดโลโก้: ' + (err.message || 'โปรดตรวจสอบสิทธิ์ Storage Bucket'));
    } finally {
      setProcessing(false);
    }
  };

  const handleUploadBackground = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin || !bgImageFile) {
      alert('กรุณาเลือกไฟล์รูปภาพพื้นหลัง');
      return;
    }

    setProcessing(true);
    try {
      const fileExt = bgImageFile.name.split('.').pop();
      const fileName = `bg_watermark_${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('drop-maps')
        .upload(filePath, bgImageFile);

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from('drop-maps')
        .getPublicUrl(filePath);

      const bgUrl = publicUrlData.publicUrl;

      const { error: dbError } = await supabase
        .from('app_settings')
        .upsert({ key: 'bg_watermark', value: bgUrl }, { onConflict: 'key' });

      if (dbError) throw dbError;

      setCurrentBgUrl(bgUrl);
      setBgImageFile(null);
      alert('อัปโหลดและเปลี่ยนรูปลายน้ำในตารางสำเร็จ!');
    } catch (err: any) {
      console.error('Error uploading background:', err);
      alert('เกิดข้อผิดพลาดในการอัปโหลด: ' + (err.message || 'โปรดตรวจสอบสิทธิ์ Storage Bucket'));
    } finally {
      setProcessing(false);
    }
  };

  const handleRemoveBackground = async () => {
    if (!confirm('ยืนยันการลบรูปลายน้ำออกจากตาราง?')) return;

    setProcessing(true);
    try {
      await supabase
        .from('app_settings')
        .upsert({ key: 'bg_watermark', value: '' }, { onConflict: 'key' });

      setCurrentBgUrl('');
      alert('ลบรูปลายน้ำออกจากตารางเรียบร้อยแล้ว');
    } catch (err: any) {
      console.error(err);
      alert('เกิดข้อผิดพลาด: ' + err.message);
    } finally {
      setProcessing(false);
    }
  };

  const handleSaveAllBatchScores = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;

    setProcessing(true);
    try {
      for (const team of allTeams) {
        const input = batchInputs[team.id];
        if (!input || input.place === '') continue;

        const placeVal = Number(input.place);
        const killsVal = Number(input.kills) || 0;
        const pPoints = placementPointsMap[placeVal] || 0;
        const kPoints = killsVal;
        const newMatchTotal = pPoints + kPoints;

        const existingLog = matchLogs.find(
          (l) => String(l.team_id).trim() === String(team.id).trim() && Number(l.game_number) === batchGameNumber
        );

        let updatedWWCD = team.wwcd || 0;
        let updatedPlace = team.place_points || 0;
        let updatedKill = team.kill_points || 0;
        let updatedTotal = team.total_points || 0;

        if (existingLog) {
          const oldWWCDVal = existingLog.wwcd || 0;
          const oldPlaceVal = existingLog.place_points || 0;
          const oldKillVal = existingLog.kill_points || 0;
          const oldTotalVal = oldPlaceVal + oldKillVal;

          if (input.wwcd && oldWWCDVal === 0) updatedWWCD = (team.wwcd || 0) + 1;
          else if (!input.wwcd && oldWWCDVal > 0) updatedWWCD = Math.max(0, (team.wwcd || 0) - 1);

          updatedPlace = updatedPlace - oldPlaceVal + pPoints;
          updatedKill = updatedKill - oldKillVal + kPoints;
          updatedTotal = updatedTotal - oldTotalVal + newMatchTotal;

          await supabase
            .from('match_logs')
            .update({ 
              map_name: batchMapName, 
              place: placeVal, 
              place_points: pPoints, 
              kill_points: kPoints, 
              wwcd: input.wwcd ? 1 : 0 
            })
            .eq('id', existingLog.id);
        } else {
          updatedWWCD = input.wwcd ? updatedWWCD + 1 : updatedWWCD;
          updatedPlace += pPoints;
          updatedKill += kPoints;
          updatedTotal += newMatchTotal;

          await supabase.from('match_logs').insert([
            {
              team_id: team.id,
              division_id: team.division_id,
              game_number: batchGameNumber,
              map_name: batchMapName,
              place: placeVal,
              place_points: pPoints,
              kill_points: kPoints,
              wwcd: input.wwcd ? 1 : 0,
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
          .eq('id', team.id);
      }

      alert(`บันทึกคะแนนเกมที่ ${batchGameNumber} สำเร็จทุกทีมเรียบร้อย!`);
      await fetchTeamsAndLogs();
      setActiveTab('latestseason');
    } catch (err: any) {
      console.error(err);
      alert('เกิดข้อผิดพลาดในการบันทึก: ' + (err.message || 'โปรดลองใหม่อีกครั้ง'));
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
        alert('เกิดข้อผิดพลาดในการบันทึกซีซั่น: ' + insertErr.message);
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

  const currentD1Count = allTeams.filter((t) => t.division_id === 1).length;
  const currentD2Count = allTeams.filter((t) => t.division_id === 2).length;

  const sortedTeamsD1ByName = [...teamsD1].sort((a, b) => a.team_name.localeCompare(b.team_name));
  const sortedTeamsD2ByName = [...teamsD2].sort((a, b) => a.team_name.localeCompare(b.team_name));

  const filteredAllTeamsForAdd = allTeams.filter((t) =>
    t.team_name.toLowerCase().includes(batchSearchQuery.toLowerCase())
  );

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 font-sans relative">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <header className="bg-slate-900/90 backdrop-blur-md border border-sky-500/30 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row justify-between items-center gap-4 text-center md:text-left">
          <div>
            <h1 className="text-3xl md:text-4xl font-black tracking-wider text-sky-400">
              CONYSWEETxiSOTOPE SCRIM LEADERBOARD
            </h1>
          </div>
          <div>
            <button
              onClick={handleToggleAdmin}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition border flex items-center gap-2 ${
                isAdmin
                  ? 'bg-sky-500/10 border-sky-500 text-sky-400 shadow-lg shadow-sky-500/10'
                  : 'bg-slate-950 border-slate-700 text-slate-400 hover:text-slate-200'
              }`}
            >
              {isAdmin ? 'Admin Mode (On)' : 'เข้าสู่ระบบแอดมิน'}
            </button>
          </div>
        </header>

        {/* Tabs */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:flex lg:flex-wrap gap-2 w-full">
          <button
            onClick={() => setActiveTab('teams')}
            className={`py-3 px-4 rounded-xl font-bold transition text-sm border flex-1 text-center ${
              activeTab === 'teams'
                ? 'bg-sky-500/10 border-sky-500 text-sky-400'
                : 'bg-slate-900/90 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            ไลน์อัพทีมทั้งหมด
          </button>
          <button
            onClick={() => setActiveTab('latestseason')}
            className={`py-3 px-4 rounded-xl font-bold transition text-sm border flex-1 text-center ${
              activeTab === 'latestseason'
                ? 'bg-sky-500/10 border-sky-500 text-sky-400'
                : 'bg-slate-900/90 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            ซีซั่นล่าสุด (D1 & D2)
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`py-3 px-4 rounded-xl font-bold transition text-sm border flex-1 text-center ${
              activeTab === 'history'
                ? 'bg-sky-500/10 border-sky-400 text-sky-400'
                : 'bg-slate-900/90 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            ซีซั่นทั้งหมด
          </button>
          <button
            onClick={() => setActiveTab('halloffame')}
            className={`py-3 px-4 rounded-xl font-bold transition text-sm border flex-1 text-center ${
              activeTab === 'halloffame'
                ? 'bg-sky-500/10 border-sky-500 text-sky-400'
                : 'bg-slate-900/90 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            Hall of Fame
          </button>
          <button
            onClick={() => setActiveTab('dropmap')}
            className={`py-3 px-4 rounded-xl font-bold transition text-sm border flex-1 text-center ${
              activeTab === 'dropmap'
                ? 'bg-sky-500/10 border-sky-500 text-sky-400'
                : 'bg-slate-900/90 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            Drop Map
          </button>
          {isAdmin && (
            <button
              onClick={() => setActiveTab('match')}
              className={`py-3 px-4 rounded-xl font-bold transition text-sm border flex-1 text-center col-span-2 sm:col-span-1 ${
                activeTab === 'match'
                  ? 'bg-sky-500/10 border-sky-500 text-sky-400'
                  : 'bg-slate-900/90 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              กรอกคะแนน (Admin)
            </button>
          )}
        </div>

        {/* Admin Accordion Menu */}
        {isAdmin && activeTab !== 'match' && (
          <div className="bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-2xl p-4 shadow-xl space-y-3">
            <div className="flex items-center justify-between px-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">🛠️ แผงควบคุมผู้ดูแลระบบ (Admin Menu)</span>
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                onClick={() => setAdminMenu(adminMenu === 'logo' ? null : 'logo')}
                className={`py-3 px-3 rounded-xl text-xs font-bold transition border flex items-center justify-center gap-1.5 ${
                  adminMenu === 'logo'
                    ? 'bg-sky-500 text-slate-950 border-sky-400 shadow-md'
                    : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                <span>🖼️ โลโก้ทีม</span>
              </button>
              
              <button
                onClick={() => setAdminMenu(adminMenu === 'team' ? null : 'team')}
                className={`py-3 px-3 rounded-xl text-xs font-bold transition border flex items-center justify-center gap-1.5 ${
                  adminMenu === 'team'
                    ? 'bg-sky-500 text-slate-950 border-sky-400 shadow-md'
                    : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                <span>➕ เพิ่ม/ค้นหาทีม</span>
              </button>

              <button
                onClick={() => setAdminMenu(adminMenu === 'season' ? null : 'season')}
                className={`py-3 px-3 rounded-xl text-xs font-bold transition border flex items-center justify-center gap-1.5 ${
                  adminMenu === 'season'
                    ? 'bg-sky-500 text-slate-950 border-sky-400 shadow-md'
                    : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                <span>🏆 จบซีซั่น</span>
              </button>

              <button
                onClick={() => setAdminMenu(adminMenu === 'bg' ? null : 'bg')}
                className={`py-3 px-3 rounded-xl text-xs font-bold transition border flex items-center justify-center gap-1.5 ${
                  adminMenu === 'bg'
                    ? 'bg-sky-500 text-slate-950 border-sky-400 shadow-md'
                    : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                <span>🎨 ลายน้ำตาราง D1/D2</span>
              </button>
            </div>

            {/* เมนูที่ 1: อัปโหลดโลโก้ทีม */}
            {adminMenu === 'logo' && (
              <div className="bg-slate-950 border border-sky-500/30 rounded-2xl p-5 shadow-xl space-y-4 mt-2 animate-fadeIn">
                <h3 className="text-sm font-bold text-sky-400">[Admin] อัปโหลด / เปลี่ยนรูปโลโก้ประจำทีม</h3>
                <form onSubmit={handleUploadTeamLogo} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">เลือกทีมที่ต้องการใส่โลโก้</label>
                    <select
                      value={selectedTeamForLogo}
                      onChange={(e) => setSelectedTeamForLogo(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-100"
                    >
                      <option value="">-- เลือกทีม --</option>
                      {allTeams.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.team_name} (Div {t.division_id})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">ไฟล์รูปโลโก้ทีม</label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => setTeamLogoFile(e.target.files ? e.target.files[0] : null)}
                      className="w-full text-xs text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-sky-500 file:text-slate-950 hover:file:bg-sky-400 cursor-pointer"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={processing || !selectedTeamForLogo || !teamLogoFile}
                    className="w-full bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold py-2.5 px-6 rounded-xl text-sm transition disabled:opacity-50"
                  >
                    {processing ? 'กำลังอัปโหลด...' : 'อัปโหลดโลโก้ทีม'}
                  </button>
                </form>
              </div>
            )}

            {/* เมนูที่ 2: เพิ่มทีมใหม่ / ค้นหาทีม */}
            {adminMenu === 'team' && (
              <div className="bg-slate-950 border border-sky-500/30 rounded-2xl p-5 shadow-xl space-y-4 mt-2 animate-fadeIn">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2">
                  <h3 className="text-sm font-bold text-sky-400">[Admin] เพิ่มทีมใหม่ / ค้นหาทีมที่มีอยู่</h3>
                  <span className="text-xs text-slate-400">พิมพ์ค้นหาด้านล่างเพื่อเลือกชื่อทีมเดิม (ป้องกันชื่อเพี้ยน)</span>
                </div>

                <div className="space-y-2">
                  <input
                    type="text"
                    value={batchSearchQuery}
                    onChange={(e) => setBatchSearchQuery(e.target.value)}
                    placeholder="ค้นหาชื่อทีมที่มีในระบบเพื่อดึงชื่อมาใช้..."
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-sky-500"
                  />

                  {batchSearchQuery.trim() !== '' && (
                    <div className="bg-slate-900 border border-sky-500/40 rounded-xl p-2 max-h-40 overflow-y-auto flex flex-wrap gap-2">
                      {filteredAllTeamsForAdd.length > 0 ? (
                        filteredAllTeamsForAdd.map((t) => (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => {
                              setNewTeamName(t.team_name);
                              setNewTeamDivision(String(t.division_id) as '1' | '2');
                              setBatchSearchQuery('');
                            }}
                            className="bg-slate-950 hover:bg-sky-500/20 border border-slate-700 hover:border-sky-500 text-slate-200 px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-2"
                          >
                            <span>{t.team_name}</span>
                            <span className="text-[10px] text-sky-400">(Div {t.division_id})</span>
                          </button>
                        ))
                      ) : (
                        <span className="text-xs text-slate-500 p-2">ไม่พบชื่อทีมที่ตรงกัน สามารถพิมพ์ชื่อใหม่ด้านล่างเพื่อเพิ่มได้เลย</span>
                      )}
                    </div>
                  )}
                </div>

                <form onSubmit={handleAddTeam} className="flex flex-col md:flex-row gap-3 pt-2 border-t border-slate-800">
                  <input
                    type="text"
                    value={newTeamName}
                    onChange={(e) => setNewTeamName(e.target.value)}
                    placeholder="ชื่อทีม..."
                    className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-sky-500"
                  />
                  <select
                    value={newTeamDivision}
                    onChange={(e) => setNewTeamDivision(e.target.value as '1' | '2')}
                    className="w-full md:w-48 bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-100"
                  >
                    <option value="2">Division 2</option>
                    <option value="1">Division 1</option>
                  </select>
                  <button type="submit" disabled={processing} className="bg-sky-500 text-slate-950 font-bold px-6 py-2.5 rounded-xl text-sm">
                    บันทึกทีม
                  </button>
                </form>
              </div>
            )}

            {/* เมนูที่ 3: จบซีซั่น & สลับโควต้า */}
            {adminMenu === 'season' && (
              <div className="bg-slate-950 border border-sky-500/30 rounded-2xl p-5 shadow-xl flex flex-col md:flex-row gap-3 items-center mt-2 animate-fadeIn">
                <input
                  type="text"
                  value={seasonNote}
                  onChange={(e) => setSeasonNote(e.target.value)}
                  placeholder="ระบุชื่อซีซั่น (เช่น Season 1)..."
                  className="flex-1 w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-100"
                />
                <button onClick={handleNextSeasonTransition} disabled={processing} className="w-full md:w-auto bg-sky-500 text-slate-950 font-bold px-6 py-3 rounded-xl text-sm shadow-lg">
                  จบซีซั่น & สลับโควต้า
                </button>
              </div>
            )}

            {/* เมนูที่ 4: ตั้งค่ารูปลายน้ำในตาราง D1/D2 */}
            {adminMenu === 'bg' && (
              <div className="bg-slate-950 border border-sky-500/30 rounded-2xl p-5 shadow-xl space-y-4 mt-2 animate-fadeIn">
                <div className="flex justify-between items-center">
                  <h3 className="text-sm font-bold text-sky-400">[Admin] ตั้งค่ารูปลายน้ำในกรอบตาราง D1 / D2</h3>
                  {currentBgUrl && (
                    <button
                      type="button"
                      onClick={handleRemoveBackground}
                      disabled={processing}
                      className="bg-rose-500/10 border border-rose-500/30 text-rose-400 hover:bg-rose-500 hover:text-slate-950 px-3 py-1.5 rounded-xl text-xs font-bold transition"
                    >
                      ลบลายน้ำออก
                    </button>
                  )}
                </div>

                <form onSubmit={handleUploadBackground} className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">เลือกไฟล์รูปโลโก้ทำลายน้ำตาราง</label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => setBgImageFile(e.target.files ? e.target.files[0] : null)}
                      className="w-full text-xs text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-sky-500 file:text-slate-950 hover:file:bg-sky-400 cursor-pointer"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={processing || !bgImageFile}
                    className="w-full bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold py-2.5 px-6 rounded-xl text-sm transition disabled:opacity-50"
                  >
                    {processing ? 'กำลังบันทึก...' : 'อัปโหลดและแสดงในตาราง'}
                  </button>
                </form>

                {currentBgUrl && (
                  <div className="flex items-center gap-3 pt-2 border-t border-slate-800 text-xs text-slate-400">
                    <span>สถานะ: แสดงลายน้ำในตาราง D1 และ D2 เรียบร้อยแล้ว</span>
                    <a href={currentBgUrl} target="_blank" rel="noreferrer" className="text-sky-400 underline">ดูรูปภาพ</a>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Content Section */}
        {activeTab === 'teams' ? (
          <div className="bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
            <div className="flex bg-slate-950 border border-slate-800 rounded-2xl p-1.5 w-full shadow-inner">
              <button
                onClick={() => setShowcaseSubTab('D1')}
                className={`flex-1 py-3.5 px-6 rounded-xl text-sm font-black transition-all duration-300 flex items-center justify-center gap-2 ${
                  showcaseSubTab === 'D1'
                    ? 'bg-sky-500 text-slate-950 shadow-lg shadow-sky-500/30 scale-[1.01]'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <span>Division 1</span>
              </button>
              <button
                onClick={() => setShowcaseSubTab('D2')}
                className={`flex-1 py-3.5 px-6 rounded-xl text-sm font-black transition-all duration-300 flex items-center justify-center gap-2 ${
                  showcaseSubTab === 'D2'
                    ? 'bg-sky-500 text-slate-950 shadow-lg shadow-sky-500/30 scale-[1.01]'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <span>Division 2</span>
              </button>
            </div>

            {showcaseSubTab === 'D1' ? (
              <div className="space-y-4 pt-2">
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                  {sortedTeamsD1ByName.map((team, idx) => (
                    <div
                      key={team.id}
                      onClick={() => handleOpenShowcaseTeamModal(team)}
                      className="relative overflow-hidden bg-slate-950 border border-slate-800/90 hover:border-sky-500/50 rounded-2xl p-5 flex flex-col items-center text-center gap-4 transition shadow-xl group cursor-pointer"
                    >
                      {team.logo_url && (
                        <div className="absolute inset-0 flex items-center justify-center opacity-10 pointer-events-none overflow-hidden scale-125 group-hover:scale-150 transition duration-500">
                          <img src={team.logo_url} alt="" className="w-full h-full object-cover blur-[1px]" />
                        </div>
                      )}

                      <span className="absolute top-3 left-3 text-xs font-black text-sky-400/90 bg-sky-500/10 px-2.5 py-1 rounded-lg border border-sky-500/20">
                        #{idx + 1}
                      </span>

                      <div className="relative z-10 w-24 h-24 rounded-2xl bg-slate-900/90 border border-sky-500/30 flex items-center justify-center overflow-hidden shrink-0 shadow-xl group-hover:scale-105 transition mt-2">
                        {team.logo_url ? (
                          <img src={team.logo_url} alt={team.team_name} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-4xl font-black text-sky-400">{team.team_name.charAt(0)}</span>
                        )}
                      </div>

                      <div className="relative z-10 min-w-0 w-full bg-slate-900/70 backdrop-blur-sm rounded-xl py-2 px-2 border border-slate-800/80">
                        <h4 className="font-extrabold text-slate-100 text-sm truncate w-full tracking-wide group-hover:text-sky-300 transition" title={team.team_name}>
                          {team.team_name}
                        </h4>
                      </div>
                    </div>
                  ))}
                  {sortedTeamsD1ByName.length === 0 && (
                    <div className="col-span-full text-center py-12 text-slate-500 text-xs">
                      ยังไม่มีรายชื่อทีมใน Division 1
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-4 pt-2">
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
                  {sortedTeamsD2ByName.map((team, idx) => (
                    <div
                      key={team.id}
                      onClick={() => handleOpenShowcaseTeamModal(team)}
                      className="relative overflow-hidden bg-slate-950 border border-slate-800/90 hover:border-sky-500/50 rounded-xl p-3.5 flex flex-col items-center text-center gap-3 transition shadow-xl group cursor-pointer"
                    >
                      {team.logo_url && (
                        <div className="absolute inset-0 flex items-center justify-center opacity-10 pointer-events-none overflow-hidden scale-125 group-hover:scale-150 transition duration-500">
                          <img src={team.logo_url} alt="" className="w-full h-full object-cover blur-[1px]" />
                        </div>
                      )}

                      <span className="absolute top-2 left-2.5 text-[10px] font-black text-sky-400/80 bg-sky-500/10 px-1.5 py-0.5 rounded border border-sky-500/20">
                        #{idx + 1}
                      </span>

                      <div className="relative z-10 w-16 h-16 rounded-xl bg-slate-900/90 border border-sky-500/30 flex items-center justify-center overflow-hidden shrink-0 shadow-lg group-hover:scale-105 transition">
                        {team.logo_url ? (
                          <img src={team.logo_url} alt={team.team_name} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-2xl font-black text-sky-400">{team.team_name.charAt(0)}</span>
                        )}
                      </div>

                      <div className="relative z-10 min-w-0 w-full bg-slate-900/60 backdrop-blur-sm rounded-lg py-1 px-1 border border-slate-800/80">
                        <h4 className="font-bold text-slate-100 text-xs truncate w-full tracking-wide group-hover:text-sky-300 transition" title={team.team_name}>
                          {team.team_name}
                        </h4>
                      </div>
                    </div>
                  ))}
                  {sortedTeamsD2ByName.length === 0 && (
                    <div className="col-span-full text-center py-12 text-slate-500 text-xs">
                      ยังไม่มีรายชื่อทีมใน Division 2
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : activeTab === 'match' && isAdmin ? (
          <div className="bg-slate-900/90 backdrop-blur-md border border-sky-500/30 rounded-2xl p-6 shadow-xl space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h2 className="text-xl font-bold text-sky-400 flex items-center gap-2">
                  <span>กรอกคะแนนทุกทีมพร้อมกัน (Batch Input)</span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">เลือกเกมและแผนที่ จากนั้นกรอกอันดับและคิลของแต่ละทีมแล้วกดบันทึกทีเดียว</p>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 font-semibold">เกมที่:</span>
                  <select
                    value={batchGameNumber}
                    onChange={(e) => setBatchGameNumber(Number(e.target.value))}
                    className="bg-slate-950 border border-sky-500/50 rounded-xl px-3 py-2 text-xs text-sky-300 font-bold focus:outline-none"
                  >
                    {[1, 2, 3, 4, 5, 6].map((num) => (
                      <option key={num} value={num}>เกมที่ {num}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 font-semibold">แผนที่:</span>
                  <select
                    value={batchMapName}
                    onChange={(e) => setBatchMapName(e.target.value)}
                    className="bg-slate-950 border border-sky-500/50 rounded-xl px-3 py-2 text-xs text-sky-300 font-bold focus:outline-none"
                  >
                    <option value="Erangel">Erangel</option>
                    <option value="Miramar">Miramar</option>
                    <option value="Rondo">Rondo</option>
                  </select>
                </div>
              </div>
            </div>

            <form onSubmit={handleSaveAllBatchScores} className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
                  <h3 className="font-bold text-sky-400 text-sm">Division 1 ({teamsD1.length} ทีม)</h3>
                  <div className="w-full">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-slate-800 text-slate-300 text-sm">
                          <th className="py-3 px-3">ชื่อทีม</th>
                          <th className="py-3 px-3 text-center w-28">อันดับ (1-16)</th>
                          <th className="py-3 px-3 text-center w-28">คิล</th>
                          <th className="py-3 px-3 text-center w-24">WWCD (ไก่)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {teamsD1.map((team) => (
                          <tr key={team.id} className="border-b border-slate-900/60">
                            <td className="py-3.5 px-3 font-bold text-slate-100 text-base">{team.team_name}</td>
                            <td className="py-3.5 px-3 text-center">
                              <input
                                type="number"
                                min="1"
                                max="16"
                                value={batchInputs[team.id]?.place || ''}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setBatchInputs((prev) => ({
                                    ...prev,
                                    [team.id]: { ...(prev[team.id] || { kills: '', wwcd: false }), place: val },
                                  }));
                                }}
                                placeholder="อันดับ"
                                className="w-24 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-center text-sm font-bold text-slate-100 focus:border-sky-400 focus:outline-none shadow-inner"
                              />
                            </td>
                            <td className="py-3.5 px-3 text-center">
                              <input
                                type="number"
                                min="0"
                                value={batchInputs[team.id]?.kills || ''}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setBatchInputs((prev) => ({
                                    ...prev,
                                    [team.id]: { ...(prev[team.id] || { place: '', wwcd: false }), kills: val },
                                  }));
                                }}
                                placeholder="คิล"
                                className="w-24 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-center text-sm font-bold text-slate-100 focus:border-sky-400 focus:outline-none shadow-inner"
                              />
                            </td>
                            <td className="py-3.5 px-3 text-center">
                              <input
                                type="checkbox"
                                checked={batchInputs[team.id]?.wwcd || false}
                                onChange={(e) => {
                                  const checked = e.target.checked;
                                  setBatchInputs((prev) => ({
                                    ...prev,
                                    [team.id]: { ...(prev[team.id] || { place: '', kills: '' }), wwcd: checked },
                                  }));
                                }}
                                className="w-6 h-6 rounded-lg bg-slate-900 border-slate-700 text-sky-500 cursor-pointer accent-sky-500"
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
                  <h3 className="font-bold text-slate-300 text-sm">Division 2 ({teamsD2.length} ทีม)</h3>
                  <div className="w-full">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-slate-800 text-slate-300 text-sm">
                          <th className="py-3 px-3">ชื่อทีม</th>
                          <th className="py-3 px-3 text-center w-28">อันดับ</th>
                          <th className="py-3 px-3 text-center w-28">คิล</th>
                          <th className="py-3 px-3 text-center w-24">WWCD (ไก่)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {teamsD2.map((team) => (
                          <tr key={team.id} className="border-b border-slate-900/60">
                            <td className="py-3.5 px-3 font-bold text-slate-100 text-base">{team.team_name}</td>
                            <td className="py-3.5 px-3 text-center">
                              <input
                                type="number"
                                min="1"
                                max="20"
                                value={batchInputs[team.id]?.place || ''}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setBatchInputs((prev) => ({
                                    ...prev,
                                    [team.id]: { ...(prev[team.id] || { kills: '', wwcd: false }), place: val },
                                  }));
                                }}
                                placeholder="อันดับ"
                                className="w-24 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-center text-sm font-bold text-slate-100 focus:border-sky-400 focus:outline-none shadow-inner"
                              />
                            </td>
                            <td className="py-3.5 px-3 text-center">
                              <input
                                type="number"
                                min="0"
                                value={batchInputs[team.id]?.kills || ''}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setBatchInputs((prev) => ({
                                    ...prev,
                                    [team.id]: { ...(prev[team.id] || { place: '', wwcd: false }), kills: val },
                                  }));
                                }}
                                placeholder="คิล"
                                className="w-24 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-center text-sm font-bold text-slate-100 focus:border-sky-400 focus:outline-none shadow-inner"
                              />
                            </td>
                            <td className="py-3.5 px-3 text-center">
                              <input
                                type="checkbox"
                                checked={batchInputs[team.id]?.wwcd || false}
                                onChange={(e) => {
                                  const checked = e.target.checked;
                                  setBatchInputs((prev) => ({
                                    ...prev,
                                    [team.id]: { ...(prev[team.id] || { place: '', kills: '' }), wwcd: checked },
                                  }));
                                }}
                                className="w-6 h-6 rounded-lg bg-slate-900 border-slate-700 text-sky-500 cursor-pointer accent-sky-500"
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={processing}
                className="w-full bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold py-3.5 px-6 rounded-xl text-sm transition shadow-lg"
              >
                {processing ? 'กำลังบันทึกคะแนน...' : `บันทึกคะแนนเกมที่ ${batchGameNumber} ทั้งหมดทันที`}
              </button>
            </form>
          </div>
        ) : activeTab === 'dropmap' ? (
          <div className="bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
            <h2 className="text-xl font-bold text-sky-400">Drop Map แผนผังจุดลงแข่งขัน</h2>

            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 flex flex-col items-center justify-center min-h-[550px] shadow-2xl">
              {(() => {
                const currentImg = dropMapImages.find(
                  (img) => img.match_number === selectedDropMatch && img.season_id === selectedDropSeasonId
                );
                if (currentImg) {
                  return (
                    <div className="w-full space-y-4 text-center">
                      <div className="flex justify-between items-center px-4">
                        <span className="text-base font-bold text-sky-300">
                          เกมที่ {currentImg.match_number} ({currentImg.map_name || 'Erangel'})
                        </span>
                        <span className="text-xs text-slate-500">
                          อัปเดตล่าสุด: {new Date(currentImg.updated_at || Date.now()).toLocaleTimeString()}
                        </span>
                      </div>
                      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl flex justify-center p-2">
                        <img
                          src={currentImg.image_url}
                          alt={`Drop Map Match ${selectedDropMatch}`}
                          className="max-h-[750px] w-auto object-contain transition-transform hover:scale-105 duration-300 rounded-xl"
                        />
                      </div>
                    </div>
                  );
                } else {
                  return (
                    <div className="text-center py-24 space-y-3">
                      <p className="text-slate-400 text-sm">ยังไม่มีการอัปโหลดรูปภาพ Drop Map สำหรับเกมที่ {selectedDropMatch} ในซีซั่นนี้</p>
                    </div>
                  );
                }
              })()}
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3 w-full md:w-1/2">
                <span className="text-xs text-slate-400 font-semibold shrink-0">ซีซั่น:</span>
                <select
                  value={selectedDropSeasonId || ''}
                  onChange={(e) => setSelectedDropSeasonId(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-200 font-bold focus:border-sky-500 focus:outline-none"
                >
                  {historySeasons.map((season) => (
                    <option key={season.id} value={season.id}>
                      {season.season_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-3 w-full md:w-1/2">
                <span className="text-xs text-slate-400 font-semibold shrink-0">เลือกเกม:</span>
                <select
                  value={selectedDropMatch}
                  onChange={(e) => setSelectedDropMatch(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-sky-500/50 rounded-xl px-4 py-3 text-sm text-sky-300 font-bold focus:border-sky-500 focus:outline-none shadow-sm"
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
        ) : activeTab === 'halloffame' ? (
          <div className="bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-2xl p-8 shadow-xl space-y-8">
            <div className="flex flex-col items-center justify-center text-center space-y-4">
              <h2 className="text-3xl font-black text-sky-400 tracking-wider">Hall of Fame</h2>

              <div className="w-full max-w-sm">
                <input
                  type="text"
                  value={hallOfFameSearch}
                  onChange={(e) => setHallOfFameSearch(e.target.value)}
                  placeholder="พิมพ์ชื่อทีมเพื่อค้นหาอันดับ..."
                  className="w-full bg-slate-950 border border-sky-500/40 rounded-2xl px-5 py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-400 shadow-md text-center"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {hallOfFameData
                .filter((team) => team.team_name.toLowerCase().includes(hallOfFameSearch.toLowerCase()))
                .map((team, idx) => {
                  const realRank = hallOfFameData.findIndex((t) => t.team_name === team.team_name) + 1;
                  return (
                    <div
                      key={idx}
                      onClick={() => handleOpenHistoryTeamModal(team, 'Hall of Fame')}
                      className="relative overflow-hidden bg-slate-950 border border-slate-800 hover:border-sky-500/60 rounded-3xl p-6 transition-all duration-300 shadow-xl flex flex-col justify-between gap-6 group cursor-pointer hover:scale-[1.01]"
                    >
                      {team.logo_url && (
                        <div className="absolute inset-0 flex items-center justify-center opacity-10 pointer-events-none overflow-hidden scale-125 group-hover:scale-150 transition duration-500">
                          <img src={team.logo_url} alt="" className="w-full h-full object-cover blur-[2px]" />
                        </div>
                      )}

                      <div className="relative z-10 flex items-center justify-between">
                        <div className="flex items-center gap-5 flex-1 min-w-0">
                          <div className="w-20 h-20 rounded-2xl bg-slate-900 border border-sky-500/30 flex items-center justify-center overflow-hidden shrink-0 shadow-lg">
                            {team.logo_url ? (
                              <img src={team.logo_url} alt={team.team_name} className="w-full h-full object-cover" />
                            ) : (
                              <span className="text-3xl font-black text-sky-400">{team.team_name.charAt(0)}</span>
                            )}
                          </div>
                          <div className="min-w-0">
                            <span className="text-sm text-sky-400 font-extrabold px-2.5 py-0.5 rounded-lg bg-sky-500/10 border border-sky-500/20">
                              #{realRank}
                            </span>
                            <h3 className="font-extrabold text-slate-100 group-hover:text-sky-300 transition text-xl truncate mt-1.5" title={team.team_name}>
                              {team.team_name}
                            </h3>
                          </div>
                        </div>

                        {team.d1Titles > 0 ? (
                          <span className="text-xs bg-sky-500/10 border border-sky-500/30 text-sky-400 px-3.5 py-2 rounded-xl font-extrabold flex items-center gap-1.5 shrink-0 shadow-md">
                            {team.d1Titles} แชมป์
                          </span>
                        ) : (
                          <span className="text-xs bg-slate-800 border border-slate-700 text-slate-300 px-3.5 py-2 rounded-xl shrink-0 font-bold">
                            {team.seasonsCount} ซีซั่น
                          </span>
                        )}
                      </div>

                      <div className="relative z-10 grid grid-cols-2 gap-3 bg-slate-900/80 backdrop-blur-md border border-slate-800/90 rounded-2xl p-4 text-center">
                        <div className="p-2 border-r border-slate-800/80">
                          <div className="text-slate-400 text-xs font-semibold mb-1">ไก่รวม (WWCD)</div>
                          <div className="font-black text-sky-400 text-2xl">{team.totalWWCD}</div>
                        </div>
                        <div className="p-2">
                          <div className="text-slate-400 text-xs font-semibold mb-1">แต้มรวมตลอดกาล</div>
                          <div className="font-black text-sky-400 text-2xl">{team.totalPointsAllTime}</div>
                        </div>
                        <div className="p-2 border-r border-t border-slate-800/80 pt-3">
                          <div className="text-slate-400 text-xs font-semibold mb-1">แต้มอันดับสะสม</div>
                          <div className="font-bold text-slate-200 text-lg">{team.totalPlacePoints}</div>
                        </div>
                        <div className="p-2 border-t border-slate-800/80 pt-3">
                          <div className="text-slate-400 text-xs font-semibold mb-1">แต้มคิลสะสม</div>
                          <div className="font-bold text-slate-200 text-lg">{team.totalKillPoints}</div>
                        </div>
                      </div>

                      <div className="relative z-10 flex flex-col gap-2 pt-2 border-t border-slate-900">
                        <div className="text-xs text-slate-400 truncate">
                          <span className="text-slate-500 font-medium">ซีซั่นที่เข้าร่วม:</span> <span className="text-slate-200 font-semibold">{team.seasonsDetails.map((s: any) => s.season_name).join(', ')}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              {hallOfFameData.filter((team) => team.team_name.toLowerCase().includes(hallOfFameSearch.toLowerCase())).length === 0 && (
                <div className="col-span-full text-center py-16 text-slate-500 text-sm">
                  ไม่พบทีมที่คุณค้นหาใน Hall of Fame
                </div>
              )}
            </div>
          </div>
        ) : activeTab === 'latestseason' ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* Division 1 Leaderboard */}
              <div className="relative overflow-hidden bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
                {currentBgUrl && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
                    <img src={currentBgUrl} alt="" className="w-[300px] h-auto object-contain opacity-[0.06] blur-[1px]" />
                  </div>
                )}
                <div className="relative z-10 space-y-4">
                  <h2 className="text-xl font-bold text-sky-400 flex items-center justify-between">
                    <span>Division 1 Leaderboard</span>
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
                            <td className="py-3 px-2 font-bold text-sky-400">{idx + 1}</td>
                            <td className="py-3 px-2 font-semibold text-slate-200">{team.team_name}</td>
                            <td className="py-3 px-2 text-center text-sky-400 font-bold">{team.wwcd || 0}</td>
                            <td className="py-3 px-2 text-center text-slate-300">{team.place_points || 0}</td>
                            <td className="py-3 px-2 text-center text-slate-300">{team.kill_points || 0}</td>
                            <td className="py-3 px-2 text-right font-extrabold text-sky-400 text-base">{team.total_points || 0}</td>
                            {isAdmin && (
                              <td className="py-3 px-2 text-center" onClick={(e) => e.stopPropagation()}>
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    onClick={() => handleOpenSwapModal(team)}
                                    className="bg-sky-500/10 border border-sky-500/30 text-sky-400 hover:bg-sky-500 hover:text-slate-950 px-2 py-1 rounded-lg text-xs font-bold transition"
                                    title="สลับทีมขึ้น/ลงดิวิชัน"
                                  >
                                    สลับ
                                  </button>
                                  <button
                                    onClick={() => handleDeleteTeam(team.id, team.team_name)}
                                    className="bg-rose-500/10 border border-rose-500/30 text-rose-400 hover:bg-rose-500 hover:text-slate-950 px-2 py-1 rounded-lg text-xs font-bold transition"
                                  >
                                    ลบ
                                  </button>
                                </div>
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
              </div>

              {/* Division 2 Leaderboard */}
              <div className="relative overflow-hidden bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
                {currentBgUrl && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
                    <img src={currentBgUrl} alt="" className="w-[300px] h-auto object-contain opacity-[0.06] blur-[1px]" />
                  </div>
                )}
                <div className="relative z-10 space-y-4">
                  <h2 className="text-xl font-bold text-slate-300 flex items-center justify-between">
                    <span>Division 2 Leaderboard</span>
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
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    onClick={() => handleOpenSwapModal(team)}
                                    className="bg-sky-500/10 border border-sky-500/30 text-sky-400 hover:bg-sky-500 hover:text-slate-950 px-2 py-1 rounded-lg text-xs font-bold transition"
                                    title="สลับทีมขึ้น/ลงดิวิชัน"
                                  >
                                    สลับ
                                  </button>
                                  <button
                                    onClick={() => handleDeleteTeam(team.id, team.team_name)}
                                    className="bg-rose-500/10 border border-rose-500/30 text-rose-400 hover:bg-rose-500 hover:text-slate-950 px-2 py-1 rounded-lg text-xs font-bold transition"
                                  >
                                    ลบ
                                  </button>
                                </div>
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
          </div>
        ) : activeTab === 'history' ? (
          <div className="bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-2xl p-8 shadow-xl space-y-8">
            <div className="flex flex-col items-center justify-center text-center space-y-4">
              <h2 className="text-3xl font-black text-sky-400 tracking-wider">ซีซั่นทั้งหมด</h2>

              <div className="flex items-center gap-3 w-full max-w-sm justify-center">
                <span className="text-xs text-slate-400 font-semibold">เลือกซีซั่น:</span>
                <select
                  value={selectedSeason?.id || ''}
                  onChange={(e) => {
                    const found = historySeasons.find((s) => s.id === Number(e.target.value));
                    if (found) setSelectedSeason(found);
                  }}
                  className="bg-slate-950 border border-sky-500/50 rounded-2xl px-5 py-3 text-sm text-sky-300 font-bold focus:border-sky-500 focus:outline-none shadow-md w-full"
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
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl">
                  <h3 className="font-extrabold text-sky-400 text-lg">Division 1 ({selectedSeason.season_name})</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-slate-800 text-slate-400 text-xs">
                          <th className="py-3 px-3">#</th>
                          <th className="py-3 px-3">ทีม (คลิกเพื่อดูสถิติซีซั่น)</th>
                          <th className="py-3 px-3 text-center">WWCD</th>
                          <th className="py-3 px-3 text-center">แต้มอันดับ</th>
                          <th className="py-3 px-3 text-center">แต้มคิล</th>
                          <th className="py-3 px-3 text-right">แต้มรวม</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedSeason.d1_snapshot?.map((t: any, idx: number) => {
                          const key = t.team_name.trim().toLowerCase();
                          const hofMatch = hallOfFameData.find((h) => h.team_name.trim().toLowerCase() === key);
                          const teamDataToPass = hofMatch || {
                            team_name: t.team_name,
                            logo_url: t.logo_url || '',
                            totalWWCD: t.wwcd || 0,
                            totalPlacePoints: t.place_points || 0,
                            totalKillPoints: t.kill_points || 0,
                            totalPointsAllTime: t.total_points || 0,
                            seasonsDetails: [{
                              season_name: selectedSeason.season_name,
                              division: 'Division 1',
                              rank: idx + 1,
                              wwcd: t.wwcd || 0,
                              place_points: t.place_points || 0,
                              kill_points: t.kill_points || 0,
                              total_points: t.total_points || 0
                            }]
                          };
                          return (
                            <tr 
                              key={idx} 
                              onClick={() => handleOpenHistoryTeamModal(teamDataToPass, 'Division 1')}
                              className="border-b border-slate-900/60 hover:bg-slate-900/80 cursor-pointer transition"
                              title="คลิกเพื่อดูสถิติซีซั่น"
                            >
                              <td className="py-3 px-3 font-bold text-slate-400">{idx + 1}</td>
                              <td className="py-3 px-3 font-semibold text-sky-300 hover:underline flex items-center gap-2">
                                <span>{t.team_name}</span>
                              </td>
                              <td className="py-3 px-3 text-center text-sky-400 font-bold">{t.wwcd || 0}</td>
                              <td className="py-3 px-3 text-center text-slate-300">{t.place_points || 0}</td>
                              <td className="py-3 px-3 text-center text-slate-300">{t.kill_points || 0}</td>
                              <td className="py-3 px-3 text-right font-extrabold text-sky-400 text-base">{t.total_points || 0}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl">
                  <h3 className="font-extrabold text-slate-300 text-lg">Division 2 ({selectedSeason.season_name})</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-slate-800 text-slate-400 text-xs">
                          <th className="py-3 px-3">#</th>
                          <th className="py-3 px-3">ทีม (คลิกเพื่อดูสถิติซีซั่น)</th>
                          <th className="py-3 px-3 text-center">WWCD</th>
                          <th className="py-3 px-3 text-center">แต้มอันดับ</th>
                          <th className="py-3 px-3 text-center">แต้มคิล</th>
                          <th className="py-3 px-3 text-right">แต้มรวม</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedSeason.d2_snapshot?.map((t: any, idx: number) => {
                          const key = t.team_name.trim().toLowerCase();
                          const hofMatch = hallOfFameData.find((h) => h.team_name.trim().toLowerCase() === key);
                          const teamDataToPass = hofMatch || {
                            team_name: t.team_name,
                            logo_url: t.logo_url || '',
                            totalWWCD: t.wwcd || 0,
                            totalPlacePoints: t.place_points || 0,
                            totalKillPoints: t.kill_points || 0,
                            totalPointsAllTime: t.total_points || 0,
                            seasonsDetails: [{
                              season_name: selectedSeason.season_name,
                              division: 'Division 2',
                              rank: idx + 1,
                              wwcd: t.wwcd || 0,
                              place_points: t.place_points || 0,
                              kill_points: t.kill_points || 0,
                              total_points: t.total_points || 0
                            }]
                          };
                          return (
                            <tr 
                              key={idx} 
                              onClick={() => handleOpenHistoryTeamModal(teamDataToPass, 'Division 2')}
                              className="border-b border-slate-900/60 hover:bg-slate-900/80 cursor-pointer transition"
                              title="คลิกเพื่อดูสถิติซีซั่น"
                            >
                              <td className="py-3 px-3 font-bold text-slate-400">{idx + 1}</td>
                              <td className="py-3 px-3 font-semibold text-sky-300 hover:underline flex items-center gap-2">
                                <span>{t.team_name}</span>
                              </td>
                              <td className="py-3 px-3 text-center text-slate-400 font-bold">{t.wwcd || 0}</td>
                              <td className="py-3 px-3 text-center text-slate-300">{t.place_points || 0}</td>
                              <td className="py-3 px-3 text-center text-slate-300">{t.kill_points || 0}</td>
                              <td className="py-3 px-3 text-right font-extrabold text-slate-200 text-base">{t.total_points || 0}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-center text-slate-500 py-16 text-sm">ยังไม่มีข้อมูลประวัติซีซั่น</p>
            )}
          </div>
        ) : null}

        {/* Modal สลับดิวิชัน */}
        {isSwapModalOpen && swapSourceTeam && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex justify-center items-center p-4 z-50">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-bold text-sky-400">สลับดิวิชันทีม</h3>
                <button
                  onClick={() => setIsSwapModalOpen(false)}
                  className="text-slate-400 hover:text-slate-100 font-bold"
                >
                  ✕
                </button>
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs space-y-1">
                <span className="text-slate-400">ทีมที่ต้องการสลับตำแหน่ง:</span>
                <div className="font-extrabold text-sky-400 text-sm">
                  {swapSourceTeam.team_name}{' '}
                  <span className="text-xs text-slate-400 font-normal">( Division {swapSourceTeam.division_id} )</span>
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-300">
                  เลือกทีมจาก Division {swapSourceTeam.division_id === 1 ? '2' : '1'} ที่จะสลับขึ้นมาแทน (คลิกที่ชื่อทีม):
                </label>
                
                <div className="grid grid-cols-2 gap-2 max-h-[240px] overflow-y-auto pr-1 bg-slate-950 border border-slate-800 rounded-xl p-2">
                  {allTeams
                    .filter((t) => t.division_id !== swapSourceTeam.division_id)
                    .map((t) => {
                      const isSelected = swapTargetTeamId === t.id;
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setSwapTargetTeamId(t.id)}
                          className={`px-3 py-2.5 rounded-xl text-xs font-semibold text-left transition border flex items-center justify-between ${
                            isSelected
                              ? 'bg-sky-500/20 border-sky-500 text-sky-300 shadow-md'
                              : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                          }`}
                        >
                          <span className="truncate">{t.team_name}</span>
                          {isSelected && <span className="text-sky-400 font-bold text-xs">✓</span>}
                        </button>
                      );
                    })}
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsSwapModalOpen(false)}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 py-2.5 rounded-xl text-xs font-bold transition"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  onClick={handleExecuteSwap}
                  disabled={processing || !swapTargetTeamId}
                  className="flex-1 bg-sky-500 hover:bg-sky-400 text-slate-950 py-2.5 rounded-xl text-xs font-bold transition disabled:opacity-50"
                >
                  {processing ? 'กำลังบันทึก...' : 'ยืนยันการสลับทีม'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal รายละเอียดแต้มรายแมตช์ปัจจุบัน */}
        {isTeamDetailModalOpen && selectedTeamDetail && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex justify-center items-center p-4 z-50">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-bold text-sky-400">สถิติรายแมตช์: {selectedTeamDetail.team_name}</h3>
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
                        {log.wwcd === 1 && <span className="ml-2 bg-sky-500/10 border border-sky-500/30 text-sky-400 px-1.5 py-0.5 rounded">WWCD</span>}
                      </div>
                      <div className="text-right space-x-3">
                        <span className="text-slate-400">อันดับ {log.place} ({log.place_points} แต้ม)</span>
                        <span className="text-slate-300">คิล {log.kill_points}</span>
                        <span className="font-bold text-sky-400">รวม {(log.place_points || 0) + (log.kill_points || 0)} แต้ม</span>
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

        {/* Modal สถิติทีม (Hall of Fame / History Season Records) */}
        {isHistoryTeamModalOpen && selectedHistoryTeam && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex justify-center items-center p-4 z-50">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-6 space-y-5 shadow-2xl">
              <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-slate-950 border border-slate-700 flex items-center justify-center overflow-hidden shrink-0">
                    {selectedHistoryTeam.logo_url ? (
                      <img src={selectedHistoryTeam.logo_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-lg font-bold text-sky-400">{selectedHistoryTeam.team_name.charAt(0)}</span>
                    )}
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-sky-400">{selectedHistoryTeam.team_name}</h3>
                    <p className="text-xs text-slate-400">ประวัติผลงานในแต่ละซีซั่น</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsHistoryTeamModalOpen(false)}
                  className="text-slate-400 hover:text-slate-100 font-bold text-base bg-slate-950 w-8 h-8 rounded-full border border-slate-800 flex items-center justify-center"
                >
                  ✕
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 bg-slate-950 border border-slate-800 rounded-xl p-3 text-center text-xs">
                <div>
                  <div className="text-slate-400 text-[10px]">ไก่รวม (WWCD)</div>
                  <div className="font-extrabold text-sky-400 text-sm">{selectedHistoryTeam.totalWWCD || selectedHistoryTeam.wwcd || 0}</div>
                </div>
                <div>
                  <div className="text-slate-400 text-[10px]">แต้มรวมทั้งหมด</div>
                  <div className="font-extrabold text-sky-400 text-sm">{selectedHistoryTeam.totalPointsAllTime || selectedHistoryTeam.total_points || 0}</div>
                </div>
                <div>
                  <div className="text-slate-400 text-[10px]">แต้มอันดับสะสม</div>
                  <div className="font-bold text-slate-300">{selectedHistoryTeam.totalPlacePoints || selectedHistoryTeam.place_points || 0}</div>
                </div>
                <div>
                  <div className="text-slate-400 text-[10px]">แต้มคิลสะสม</div>
                  <div className="font-bold text-slate-300">{selectedHistoryTeam.totalKillPoints || selectedHistoryTeam.kill_points || 0}</div>
                </div>
              </div>

              <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
                <div className="text-xs font-semibold text-slate-400 mb-1">ผลงานแยกตามซีซั่น:</div>
                {historyTeamSeasonRecords.length > 0 ? (
                  historyTeamSeasonRecords.map((rec: any, i: number) => (
                    <div key={i} className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex justify-between items-center text-xs">
                      <div>
                        <span className="font-bold text-sky-400">{rec.season_name}</span>
                        <span className="text-slate-400 ml-2">({rec.division} - อันดับ {rec.rank})</span>
                        {rec.wwcd > 0 && <span className="ml-2 bg-sky-500/10 border border-sky-500/30 text-sky-400 px-1.5 py-0.5 rounded">{rec.wwcd} ไก่</span>}
                      </div>
                      <div className="text-right space-x-2">
                        <span className="text-slate-400">อันดับ {rec.place_points} แต้ม</span>
                        <span className="text-slate-300">คิล {rec.kill_points}</span>
                        <span className="font-bold text-sky-400">รวม {rec.total_points} แต้ม</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-center text-slate-500 py-6 text-xs">ยังไม่มีประวัติผลงานในซีซั่นอื่น ๆ</p>
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