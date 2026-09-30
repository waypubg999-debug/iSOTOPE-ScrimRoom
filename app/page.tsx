'use client';

import React, { useState, useEffect, useRef } from 'react';
import { supabase } from './supabase';
import * as htmlToImage from 'html-to-image';

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
  const [activeTab, setActiveTab] = useState<'latestseason' | 'match' | 'history' | 'halloffame' | 'teams'>('latestseason');
  const [showcaseSubTab, setShowcaseSubTab] = useState<'D1' | 'D2'>('D1');
  const [hallOfFameSubTab, setHallOfFameSubTab] = useState<'all' | 'D1' | 'D2'>('all');
  const [hallOfFamePage, setHallOfFamePage] = useState<number>(1);
  const itemsPerPage = 12;

  const [teamsD1, setTeamsD1] = useState<any[]>([]);
  const [teamsD2, setTeamsD2] = useState<any[]>([]);
  const [allTeams, setAllTeams] = useState<any[]>([]);
  const [matchLogs, setMatchLogs] = useState<any[]>([]);
  const [historySeasons, setHistorySeasons] = useState<any[]>([]);
  const [selectedSeason, setSelectedSeason] = useState<any>(null);
  const [historyDivisionTab, setHistoryDivisionTab] = useState<'D1' | 'D2'>('D1');
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);

  const [isAdmin, setIsAdmin] = useState(false);
  const [adminMenu, setAdminMenu] = useState<'logo' | 'team' | 'season' | 'bg' | null>(null);

  const [bgImageFile, setBgImageFile] = useState<File | null>(null);
  const [currentBgUrl, setCurrentBgUrl] = useState<string>('');

  const [selectedTeamForLogo, setSelectedTeamForLogo] = useState<string>('');
  const [teamLogoFile, setTeamLogoFile] = useState<File | null>(null);

  const [isTeamDetailModalOpen, setIsTeamDetailModalOpen] = useState(false);
  const [selectedTeamDetail, setSelectedTeamDetail] = useState<any>(null);
  const [teamMatchLogs, setTeamMatchLogs] = useState<any[]>([]);

  const [isHistoryTeamModalOpen, setIsHistoryTeamModalOpen] = useState(false);
  const [selectedHistoryTeam, setSelectedHistoryTeam] = useState<any>(null);
  const [historyTeamDivisionName, setHistoryTeamDivisionName] = useState<string>('');
  const [historyTeamSeasonRecords, setHistoryTeamSeasonRecords] = useState<any[]>([]);

  const [selectedLatestDivision, setSelectedLatestDivision] = useState<'D1' | 'D2'>('D1');

  const [hallOfFameData, setHallOfFameData] = useState<any[]>([]);
  const [hallOfFameSearch, setHallOfFameSearch] = useState('');

  const [isSwapModalOpen, setIsSwapModalOpen] = useState(false);
  const [swapSourceTeam, setSwapSourceTeam] = useState<any>(null);
  const [swapTargetTeamId, setSwapTargetTeamId] = useState<number | null>(null);

  const [batchGameNumber, setBatchGameNumber] = useState<number>(1);
  const [batchMapName, setBatchMapName] = useState<string>('Erangel');
  const [batchInputs, setBatchInputs] = useState<{ [teamId: string]: { place: string; kills: string; wwcd: boolean } }>({});
  const [batchSearchQuery, setBatchSearchQuery] = useState<string>('');
  const [batchSeasonTarget, setBatchSeasonTarget] = useState<string>('current');
  const [batchDivisionTab, setBatchDivisionTab] = useState<'D1' | 'D2'>('D1');

  const [seasonNoteD1, setSeasonNoteD1] = useState('');
  const [seasonNoteD2, setSeasonNoteD2] = useState('');

  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamDivision, setNewTeamDivision] = useState<'1' | '2'>('2');

  const showcaseRef = useRef<HTMLDivElement>(null);
  const latestInlineRef = useRef<HTMLDivElement>(null);
  const historyRef = useRef<HTMLDivElement>(null);
  const hallOfFameRef = useRef<HTMLDivElement>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownloadImage = async (refTarget: React.RefObject<HTMLDivElement | null>, fileNamePrefix: string) => {
    if (refTarget.current === null) return;
    setIsDownloading(true);
    try {
      const dataUrl = await htmlToImage.toPng(refTarget.current, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: '#020617',
      });
      const link = document.createElement('a');
      link.download = `${fileNamePrefix}_${Date.now()}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Failed to generate image:', err);
      alert('เกิดข้อผิดพลาดในการสร้างรูปภาพ');
    } finally {
      setIsDownloading(false);
    }
  };

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

    await fetchHistory();
    if (activeTab === 'halloffame' || activeTab === 'teams') {
      await fetchHallOfFame();
    }

    setLoading(false);
  };

  const sortTeamsByNameCustom = (teamList: any[]) => {
    return [...teamList].sort((a, b) => {
      const nameA = (a.team_name || '').trim();
      const nameB = (b.team_name || '').trim();

      const isEngA = /^[A-Za-z]/.test(nameA);
      const isEngB = /^[A-Za-z]/.test(nameB);

      if (isEngA && !isEngB) return -1;
      if (!isEngA && isEngB) return 1;

      return nameA.localeCompare(nameB, 'th');
    });
  };

  useEffect(() => {
    if (activeTab === 'match' && allTeams.length > 0) {
      const initialInputs: { [teamId: string]: { place: string; kills: string; wwcd: boolean } } = {};
      
      if (batchSeasonTarget === 'current') {
        allTeams.forEach((team) => {
          const existingLog = matchLogs.find(
            (l) => String(l.team_id).trim() === String(team.id).trim() && Number(l.game_number) === batchGameNumber
          );
          initialInputs[team.id] = {
            place: existingLog && existingLog.place !== null && existingLog.place !== undefined ? String(existingLog.place) : '',
            kills: existingLog && existingLog.kill_points !== null && existingLog.kill_points !== undefined ? String(existingLog.kill_points) : '',
            wwcd: existingLog ? existingLog.wwcd === 1 : false,
          };
          if (existingLog && existingLog.map_name) {
            setBatchMapName(existingLog.map_name);
          }
        });
      } else {
        const foundSeason = historySeasons.find(s => s.id === Number(batchSeasonTarget));
        if (foundSeason) {
          const combinedTeams = [...(foundSeason.d1_snapshot || []), ...(foundSeason.d2_snapshot || [])];
          combinedTeams.forEach((t: any) => {
            const teamKey = String(t.id || t.team_name);
            initialInputs[teamKey] = {
              place: t.place ? String(t.place) : '',
              kills: t.kill_points ? String(t.kill_points) : '',
              wwcd: t.wwcd > 0,
            };
          });
        }
      }
      setBatchInputs(initialInputs);
    }
  }, [batchGameNumber, batchSeasonTarget, activeTab, allTeams, matchLogs, historySeasons]);

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
        const firstSeason = data[0];
        setSelectedSeason(firstSeason);
        const hasD1 = (firstSeason.d1_snapshot || []).filter((t: any) => (t.total_points || 0) > 0 || (t.wwcd || 0) > 0 || (t.place_points || 0) > 0 || (t.kill_points || 0) > 0).length > 0;
        const hasD2 = (firstSeason.d2_snapshot || []).filter((t: any) => (t.total_points || 0) > 0 || (t.wwcd || 0) > 0 || (t.place_points || 0) > 0 || (t.kill_points || 0) > 0).length > 0;
        if (!hasD1 && hasD2) {
          setHistoryDivisionTab('D2');
        } else {
          setHistoryDivisionTab('D1');
        }
      }
    }
  };

  const fetchHallOfFame = async () => {
    const { data: historyData } = await supabase
      .from('season_history')
      .select('*')
      .order('created_at', { ascending: false });

    const { data: teamsData } = await supabase.from('teams').select('*');

    if (!historyData && !teamsData) {
      setHallOfFameData([]);
      return;
    }

    const teamMap: { [key: string]: any } = {};

    (historyData || []).forEach((season) => {
      const seasonName = season.season_name;

      const processSnapshot = (snapshot: any[], divName: string) => {
        snapshot?.forEach((t: any, idx: number) => {
          const hasPlayed = (t.total_points || 0) > 0 || (t.wwcd || 0) > 0 || (t.place_points || 0) > 0 || (t.kill_points || 0) > 0;
          if (!hasPlayed) return;

          const name = (t.team_name || '').trim();
          const key = name.toLowerCase();
          if (!key) return;

          if (!teamMap[key]) {
            const foundTeamInDb = teamsData?.find(dbT => (dbT.team_name || '').trim().toLowerCase() === key);
            teamMap[key] = { 
              team_name: name, 
              seasonsCount: 0, 
              d1Titles: 0, 
              totalWWCD: 0, 
              totalPlacePoints: 0,
              totalKillPoints: 0,
              totalPointsAllTime: 0,
              d1WWCD: 0,
              d1Points: 0,
              d2WWCD: 0,
              d2Points: 0,
              seasonsDetails: [],
              logo_url: t.logo_url || foundTeamInDb?.logo_url || ''
            };
          }
          
          teamMap[key].seasonsDetails.push({
            season_name: seasonName,
            division: divName,
            rank: idx + 1,
            wwcd: t.wwcd || 0,
            place_points: t.place_points || 0,
            kill_points: t.kill_points || 0,
            total_points: t.total_points || 0
          });

          teamMap[key].seasonsCount += 1;
          if (divName === 'Division 1' && idx === 0) {
            teamMap[key].d1Titles += 1;
          }
          teamMap[key].totalWWCD += (t.wwcd || 0);
          teamMap[key].totalPlacePoints += (t.place_points || 0);
          teamMap[key].totalKillPoints += (t.kill_points || 0);
          teamMap[key].totalPointsAllTime += (t.total_points || 0);
          if (divName === 'Division 1') {
            teamMap[key].d1WWCD += (t.wwcd || 0);
            teamMap[key].d1Points += (t.total_points || 0);
          } else {
            teamMap[key].d2WWCD += (t.wwcd || 0);
            teamMap[key].d2Points += (t.total_points || 0);
          }
          if (!teamMap[key].logo_url && t.logo_url) teamMap[key].logo_url = t.logo_url;
        });
      };

      processSnapshot(season.d1_snapshot, 'Division 1');
      processSnapshot(season.d2_snapshot, 'Division 2');
    });

    teamsData?.forEach((dbT) => {
      const name = (dbT.team_name || '').trim();
      const key = name.toLowerCase();
      if (!key) return;

      const hasValidScore = (dbT.total_points || 0) > 0 || (dbT.wwcd || 0) > 0 || (dbT.place_points || 0) > 0 || (dbT.kill_points || 0) > 0;
      if (!hasValidScore) return;

      const curDetails = {
        season_name: 'Current Season',
        division: `Division ${dbT.division_id}`,
        rank: '-',
        wwcd: dbT.wwcd || 0,
        place_points: dbT.place_points || 0,
        kill_points: dbT.kill_points || 0,
        total_points: dbT.total_points || 0
      };

      if (!teamMap[key]) {
        teamMap[key] = {
          team_name: name,
          seasonsCount: 1,
          d1Titles: 0,
          totalWWCD: dbT.wwcd || 0,
          totalPlacePoints: dbT.place_points || 0,
          totalKillPoints: dbT.kill_points || 0,
          totalPointsAllTime: dbT.total_points || 0,
          d1WWCD: dbT.division_id === 1 ? (dbT.wwcd || 0) : 0,
          d1Points: dbT.division_id === 1 ? (dbT.total_points || 0) : 0,
          d2WWCD: dbT.division_id === 2 ? (dbT.wwcd || 0) : 0,
          d2Points: dbT.division_id === 2 ? (dbT.total_points || 0) : 0,
          seasonsDetails: [curDetails],
          logo_url: dbT.logo_url || ''
        };
      } else {
        if (dbT.logo_url && !teamMap[key].logo_url) {
          teamMap[key].logo_url = dbT.logo_url;
        }
        teamMap[key].seasonsDetails.push(curDetails);
        teamMap[key].seasonsCount += 1;
        teamMap[key].totalWWCD += (dbT.wwcd || 0);
        teamMap[key].totalPlacePoints += (dbT.place_points || 0);
        teamMap[key].totalKillPoints += (dbT.kill_points || 0);
        teamMap[key].totalPointsAllTime += (dbT.total_points || 0);
        if (dbT.division_id === 1) {
          teamMap[key].d1WWCD += (dbT.wwcd || 0);
          teamMap[key].d1Points += (dbT.total_points || 0);
        } else {
          teamMap[key].d2WWCD += (dbT.wwcd || 0);
          teamMap[key].d2Points += (dbT.total_points || 0);
        }
      }
    });

    const formattedData = Object.values(teamMap)
      .filter((team: any) => team.totalPointsAllTime > 0 || team.totalWWCD > 0 || team.d1Titles > 0)
      .sort((a: any, b: any) => {
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
    const key = (team.team_name || '').trim().toLowerCase();
    const foundHof = hallOfFameData.find((h) => (h.team_name || '').trim().toLowerCase() === key);
    
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

    if (!targetData.logo_url && team.logo_url) {
      targetData.logo_url = team.logo_url;
    }

    setSelectedHistoryTeam(targetData);
    setHistoryTeamDivisionName(`Division ${team.division_id}`);
    setHistoryTeamSeasonRecords(targetData.seasonsDetails || []);
    
    setIsHistoryTeamModalOpen(true);
  };

  const handleOpenHistoryTeamModal = (team: any, divisionName: string) => {
    const key = (team.team_name || '').trim().toLowerCase();
    const foundHof = hallOfFameData.find((h) => (h.team_name || '').trim().toLowerCase() === key);
    const foundDbTeam = allTeams.find((t) => (t.team_name || '').trim().toLowerCase() === key);

    const mergedTeam = {
      ...team,
      logo_url: team.logo_url || foundHof?.logo_url || foundDbTeam?.logo_url || ''
    };

    setSelectedHistoryTeam(mergedTeam);
    setHistoryTeamDivisionName(divisionName);

    if (mergedTeam.seasonsDetails && Array.isArray(mergedTeam.seasonsDetails)) {
      setHistoryTeamSeasonRecords(mergedTeam.seasonsDetails);
    } else {
      setHistoryTeamSeasonRecords([{
        season_name: 'Current / Recorded Season',
        division: divisionName,
        rank: '-',
        wwcd: mergedTeam.wwcd || mergedTeam.totalWWCD || 0,
        place_points: mergedTeam.place_points || mergedTeam.totalPlacePoints || 0,
        kill_points: mergedTeam.kill_points || mergedTeam.totalKillPoints || 0,
        total_points: mergedTeam.total_points || mergedTeam.totalPointsAllTime || 0
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
      if (batchSeasonTarget === 'current') {
        const targetTeamsList = batchDivisionTab === 'D1' ? teamsD1 : teamsD2;
        const promises = targetTeamsList.map(async (team) => {
          const input = batchInputs[team.id] || batchInputs[String(team.id)];
          if (!input || input.place === '') return;

          const placeVal = Number(input.place);
          const killsVal = Number(input.kills) || 0;
          const pPoints = placementPointsMap[placeVal] || 0;
          const kPoints = killsVal;

          const existingLog = matchLogs.find(
            (l) => String(l.team_id).trim() === String(team.id).trim() && Number(l.game_number) === batchGameNumber
          );

          // คำนวณผลรวมใหม่ทั้งหมดของทีมนี้จาก match_logs ทุกเกม (เพื่อให้คะแนนรวมสะสมแม่นยำที่สุด)
          const otherLogs = matchLogs.filter(
            (l) => String(l.team_id).trim() === String(team.id).trim() && Number(l.game_number) !== batchGameNumber
          );

          let totalWWCD = input.wwcd ? 1 : 0;
          let totalPlace = pPoints;
          let totalKill = kPoints;

          otherLogs.forEach((l) => {
            totalWWCD += l.wwcd || 0;
            totalPlace += l.place_points || 0;
            totalKill += l.kill_points || 0;
          });

          const totalPointsVal = totalPlace + totalKill;

          if (existingLog) {
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
              wwcd: totalWWCD, 
              place_points: totalPlace, 
              kill_points: totalKill, 
              total_points: totalPointsVal 
            })
            .eq('id', team.id);
        });

        await Promise.all(promises);
      } else {
        const foundSeason = historySeasons.find(s => s.id === Number(batchSeasonTarget));
        if (foundSeason) {
          const updateSnapshot = (snapshotList: any[]) => {
            return snapshotList.map(t => {
              const key = String(t.id || t.team_name);
              const input = batchInputs[key];
              if (!input || input.place === '') return t;

              const placeVal = Number(input.place);
              const killsVal = Number(input.kills) || 0;
              const pPoints = placementPointsMap[placeVal] || 0;
              const kPoints = killsVal;
              const newTotal = pPoints + kPoints;

              return {
                ...t,
                place: placeVal,
                place_points: pPoints,
                kill_points: kPoints,
                wwcd: input.wwcd ? 1 : 0,
                total_points: newTotal
              };
            });
          };

          let newD1 = foundSeason.d1_snapshot || [];
          let newD2 = foundSeason.d2_snapshot || [];

          if (batchDivisionTab === 'D1') {
            newD1 = updateSnapshot(newD1);
          } else {
            newD2 = updateSnapshot(newD2);
          }

          await supabase
            .from('season_history')
            .update({ d1_snapshot: newD1, d2_snapshot: newD2 })
            .eq('id', foundSeason.id);
        }
      }

      alert(`บันทึกคะแนน ${batchDivisionTab} เกมที่ ${batchGameNumber} สำเร็จเรียบร้อย!`);
      await fetchTeamsAndLogs();
      setActiveTab('latestseason');
    } catch (err: any) {
      console.error(err);
      alert('เกิดข้อผิดพลาดในการบันทึก: ' + (err.message || 'โปรดลองใหม่อีกครั้ง'));
    } finally {
      setProcessing(false);
    }
  };

  const handleTransitionD1 = async () => {
    if (!isAdmin || !seasonNoteD1.trim()) {
      alert('กรุณากรอกชื่อซีซั่นของ Division 1 ก่อน');
      return;
    }
    if (!confirm(`ยืนยันจบซีซั่น D1 "${seasonNoteD1}" และทำเรื่องโควต้า (ตกชั้น/เลื่อนชั้น)?`)) return;

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

      const d1Full = mapLogsToTeam(d1Data).slice(0, 16).filter((t: any) => (t.total_points || 0) > 0 || (t.wwcd || 0) > 0 || (t.place_points || 0) > 0 || (t.kill_points || 0) > 0);

      const { error: insertErr } = await supabase.from('season_history').insert([
        { season_name: seasonNoteD1, d1_snapshot: d1Full, d2_snapshot: [] },
      ]);

      if (insertErr) {
        alert('เกิดข้อผิดพลาดในการบันทึกซีซั่น: ' + insertErr.message);
        setProcessing(false);
        return;
      }

      const d1RemainingSafe = d1Data.slice(0, 12);
      const finalD1Relegated = d1Data.slice(12, 16);

      for (const team of d1RemainingSafe) {
        await supabase.from('teams').update({ division_id: 1, wwcd: 0, place_points: 0, kill_points: 0, total_points: 0 }).eq('id', team.id);
      }
      for (const team of finalD1Relegated) {
        await supabase.from('teams').update({ division_id: 2, wwcd: 0, place_points: 0, kill_points: 0, total_points: 0 }).eq('id', team.id);
      }

      await supabase.from('match_logs').delete().in('team_id', d1Data.map(t => t.id));

      alert(`จบซีซั่น Division 1 เรียบร้อยแล้ว!`);
      setSeasonNoteD1('');
      fetchTeamsAndLogs();
    } catch (err: any) {
      console.error(err);
      alert('เกิดข้อผิดพลาด: ' + (err.message || 'โปรดลองใหม่อีกครั้ง'));
    } finally {
      setProcessing(false);
    }
  };

  const handleTransitionD2 = async () => {
    if (!isAdmin || !seasonNoteD2.trim()) {
      alert('กรุณากรอกชื่อซีซั่นของ Division 2 ก่อน');
      return;
    }
    if (!confirm(`ยืนยันจบซีซั่น D2 "${seasonNoteD2}" และทำเรื่องเลื่อนชั้น?`)) return;

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

      const d2Full = mapLogsToTeam(d2Data).slice(0, 20).filter((t: any) => (t.total_points || 0) > 0 || (t.wwcd || 0) > 0 || (t.place_points || 0) > 0 || (t.kill_points || 0) > 0);

      const { error: insertErr } = await supabase.from('season_history').insert([
        { season_name: seasonNoteD2, d1_snapshot: [], d2_snapshot: d2Full },
      ]);

      if (insertErr) {
        alert('เกิดข้อผิดพลาดในการบันทึกซีซั่น: ' + insertErr.message);
        setProcessing(false);
        return;
      }

      const finalD2Promoted = d2Data.slice(0, 4);
      const finalD2Remaining = d2Data.slice(4, 20);

      for (const team of finalD2Promoted) {
        await supabase.from('teams').update({ division_id: 1, wwcd: 0, place_points: 0, kill_points: 0, total_points: 0 }).eq('id', team.id);
      }
      for (const team of finalD2Remaining) {
        await supabase.from('teams').update({ division_id: 2, wwcd: 0, place_points: 0, kill_points: 0, total_points: 0 }).eq('id', team.id);
      }

      await supabase.from('match_logs').delete().in('team_id', d2Data.map(t => t.id));

      alert(`จบซีซั่น Division 2 เรียบร้อยแล้ว!`);
      setSeasonNoteD2('');
      fetchTeamsAndLogs();
    } catch (err: any) {
      console.error(err);
      alert('เกิดข้อผิดพลาด: ' + (err.message || 'โปรดลองใหม่อีกครั้ง'));
    } finally {
      setProcessing(false);
    }
  };

  const sortedTeamsD1ByName = sortTeamsByNameCustom(teamsD1);
  const sortedTeamsD2ByName = sortTeamsByNameCustom(teamsD2);

  const getBatchSourceTeams = () => {
    if (batchSeasonTarget === 'current') {
      return {
        d1: sortedTeamsD1ByName,
        d2: sortedTeamsD2ByName
      };
    } else {
      const found = historySeasons.find(s => s.id === Number(batchSeasonTarget));
      if (!found) return { d1: [], d2: [] };
      return {
        d1: sortTeamsByNameCustom(found.d1_snapshot || []),
        d2: sortTeamsByNameCustom(found.d2_snapshot || [])
      };
    }
  };

  const currentBatchTeams = getBatchSourceTeams();

  const filteredAllTeamsForAdd = allTeams.filter((t) =>
    t.team_name.toLowerCase().includes(batchSearchQuery.toLowerCase())
  );

  const getFilteredHallOfFameData = () => {
    let data = [...hallOfFameData];
    if (hallOfFameSubTab === 'D1') {
      data = data
        .filter((t) => (t.d1Points || 0) > 0 || (t.d1WWCD || 0) > 0 || (t.d1Titles || 0) > 0)
        .sort((a, b) => {
          if ((b.d1Titles || 0) !== (a.d1Titles || 0)) return (b.d1Titles || 0) - (a.d1Titles || 0);
          if ((b.d1Points || 0) !== (a.d1Points || 0)) return (b.d1Points || 0) - (a.d1Points || 0);
          return (b.d1WWCD || 0) - (a.d1WWCD || 0);
        });
    } else if (hallOfFameSubTab === 'D2') {
      data = data
        .filter((t) => (t.d2Points || 0) > 0 || (t.d2WWCD || 0) > 0)
        .sort((a, b) => {
          if ((b.d2Points || 0) !== (a.d2Points || 0)) return (b.d2Points || 0) - (a.d2Points || 0);
          return (b.d2WWCD || 0) - (a.d2WWCD || 0);
        });
    }

    if (hallOfFameSearch.trim() !== '') {
      data = data.filter((team) => team.team_name.toLowerCase().includes(hallOfFameSearch.toLowerCase()));
    }

    return data;
  };

  const allFilteredHofData = getFilteredHallOfFameData();
  const totalHofPages = Math.ceil(allFilteredHofData.length / itemsPerPage) || 1;
  const paginatedHofData = allFilteredHofData.slice(
    (hallOfFamePage - 1) * itemsPerPage,
    hallOfFamePage * itemsPerPage
  );

  const filteredHistoryD1 = (selectedSeason?.d1_snapshot || []).filter(
    (t: any) => (t.total_points || 0) > 0 || (t.wwcd || 0) > 0 || (t.place_points || 0) > 0 || (t.kill_points || 0) > 0
  );

  const filteredHistoryD2 = (selectedSeason?.d2_snapshot || []).filter(
    (t: any) => (t.total_points || 0) > 0 || (t.wwcd || 0) > 0 || (t.place_points || 0) > 0 || (t.kill_points || 0) > 0
  );

  const hasHistoryD1 = filteredHistoryD1.length > 0;
  const hasHistoryD2 = filteredHistoryD2.length > 0;

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
            onClick={() => { setActiveTab('halloffame'); setHallOfFamePage(1); }}
            className={`py-3 px-4 rounded-xl font-bold transition text-sm border flex-1 text-center ${
              activeTab === 'halloffame'
                ? 'bg-sky-500/10 border-sky-500 text-sky-400'
                : 'bg-slate-900/90 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            Hall of Fame
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
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">แผงควบคุมผู้ดูแลระบบ (Admin Menu)</span>
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
                <span>โลโก้ทีม</span>
              </button>
              
              <button
                onClick={() => setAdminMenu(adminMenu === 'team' ? null : 'team')}
                className={`py-3 px-3 rounded-xl text-xs font-bold transition border flex items-center justify-center gap-1.5 ${
                  adminMenu === 'team'
                    ? 'bg-sky-500 text-slate-950 border-sky-400 shadow-md'
                    : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                <span>จัดการ/เพิ่มทีม</span>
              </button>

              <button
                onClick={() => setAdminMenu(adminMenu === 'season' ? null : 'season')}
                className={`py-3 px-3 rounded-xl text-xs font-bold transition border flex items-center justify-center gap-1.5 ${
                  adminMenu === 'season'
                    ? 'bg-sky-500 text-slate-950 border-sky-400 shadow-md'
                    : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                <span>จบซีซั่น (แยก D1 / D2)</span>
              </button>

              <button
                onClick={() => setAdminMenu(adminMenu === 'bg' ? null : 'bg')}
                className={`py-3 px-3 rounded-xl text-xs font-bold transition border flex items-center justify-center gap-1.5 ${
                  adminMenu === 'bg'
                    ? 'bg-sky-500 text-slate-950 border-sky-400 shadow-md'
                    : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                <span>ลายน้ำตาราง D1/D2</span>
              </button>
            </div>

            {adminMenu === 'logo' && (
              <div className="bg-slate-950 border border-sky-500/30 rounded-2xl p-5 shadow-xl space-y-4 mt-2">
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
                          {t.team_name} (Division {t.division_id})
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

            {adminMenu === 'team' && (
              <div className="bg-slate-950 border border-sky-500/30 rounded-2xl p-5 shadow-xl space-y-4 mt-2">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2">
                  <h3 className="text-sm font-bold text-sky-400">[Admin] เพิ่มทีมใหม่ / จัดการและค้นหาทีม</h3>
                  <span className="text-xs text-slate-400">พิมพ์ค้นหาเพื่อ สลับดิวิชัน หรือ ลบทีม ได้ทันที</span>
                </div>

                <div className="space-y-2">
                  <input
                    type="text"
                    value={batchSearchQuery}
                    onChange={(e) => setBatchSearchQuery(e.target.value)}
                    placeholder="พิมพ์ชื่อทีมเพื่อค้นหา ดึงชื่อ หรือจัดการทีม..."
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-sky-500"
                  />

                  {batchSearchQuery.trim() !== '' && (
                    <div className="bg-slate-900 border border-sky-500/40 rounded-xl p-2 max-h-48 overflow-y-auto flex flex-col gap-2">
                      {filteredAllTeamsForAdd.length > 0 ? (
                        filteredAllTeamsForAdd.map((t) => (
                          <div
                            key={t.id}
                            className="bg-slate-950 border border-slate-800 text-slate-200 px-3 py-2 rounded-lg text-xs font-semibold flex items-center justify-between gap-2"
                          >
                            <div
                              className="flex items-center gap-2 cursor-pointer hover:text-sky-400"
                              onClick={() => {
                                setNewTeamName(t.team_name);
                                setNewTeamDivision(String(t.division_id) as '1' | '2');
                              }}
                            >
                              <span>{t.team_name}</span>
                              <span className="text-[10px] text-sky-400">(Division {t.division_id})</span>
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleOpenSwapModal(t)}
                                className="bg-sky-500/20 hover:bg-sky-500 text-sky-300 hover:text-slate-950 border border-sky-500/40 px-2 py-1 rounded text-[10px] font-bold transition"
                              >
                                สลับดิวิชัน
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteTeam(t.id, t.team_name)}
                                className="bg-rose-500/20 hover:bg-rose-500 text-rose-300 hover:text-white border border-rose-500/40 px-2 py-1 rounded text-[10px] font-bold transition"
                              >
                                ลบทีม
                              </button>
                            </div>
                          </div>
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
                    placeholder="ชื่อทีมใหม่..."
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
                  <button type="submit" disabled={processing} className="bg-sky-500 text-slate-950 font-bold px-6 py-2.5 rounded-xl text-sm hover:bg-sky-400 transition disabled:opacity-50">
                    บันทึกทีม
                  </button>
                </form>
              </div>
            )}

            {adminMenu === 'season' && (
              <div className="bg-slate-950 border border-sky-500/30 rounded-2xl p-5 shadow-xl space-y-4 mt-2">
                <h3 className="text-sm font-bold text-sky-400">[Admin] ระบบจบซีซั่นแยกดิวิชันอิสระ</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-800">
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
                    <h4 className="font-bold text-sky-300 text-xs uppercase tracking-wide">จบซีซั่น Division 1 (เลื่อน/ตกชั้น)</h4>
                    <input
                      type="text"
                      value={seasonNoteD1}
                      onChange={(e) => setSeasonNoteD1(e.target.value)}
                      placeholder="ชื่อซีซั่น D1 (เช่น S1-D1)..."
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2 text-xs text-slate-100"
                    />
                    <button 
                      onClick={handleTransitionD1} 
                      disabled={processing} 
                      className="w-full bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold py-2 rounded-xl text-xs shadow transition disabled:opacity-50"
                    >
                      {processing ? 'กำลังดำเนินการ...' : 'จบซีซั่น D1 เฉพาะกิจ'}
                    </button>
                  </div>

                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
                    <h4 className="font-bold text-slate-300 text-xs uppercase tracking-wide">จบซีซั่น Division 2 (เลื่อนชั้น)</h4>
                    <input
                      type="text"
                      value={seasonNoteD2}
                      onChange={(e) => setSeasonNoteD2(e.target.value)}
                      placeholder="ชื่อซีซั่น D2 (เช่น S1-D2)..."
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2 text-xs text-slate-100"
                    />
                    <button 
                      onClick={handleTransitionD2} 
                      disabled={processing} 
                      className="w-full bg-slate-200 hover:bg-white text-slate-950 font-bold py-2 rounded-xl text-xs shadow transition disabled:opacity-50"
                    >
                      {processing ? 'กำลังดำเนินการ...' : 'จบซีซั่น D2 เฉพาะกิจ'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {adminMenu === 'bg' && (
              <div className="bg-slate-950 border border-sky-500/30 rounded-2xl p-5 shadow-xl space-y-4 mt-2">
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
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex bg-slate-950 border border-slate-800 rounded-2xl p-1.5 w-full sm:w-auto shadow-inner">
                <button
                  onClick={() => setShowcaseSubTab('D1')}
                  className={`py-3 px-6 rounded-xl text-sm font-black transition-all duration-300 flex items-center justify-center gap-2 ${
                    showcaseSubTab === 'D1'
                      ? 'bg-sky-500 text-slate-950 shadow-lg shadow-sky-500/30 scale-[1.01]'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <span>Division 1</span>
                </button>
                <button
                  onClick={() => setShowcaseSubTab('D2')}
                  className={`py-3 px-6 rounded-xl text-sm font-black transition-all duration-300 flex items-center justify-center gap-2 ${
                    showcaseSubTab === 'D2'
                      ? 'bg-sky-500 text-slate-950 shadow-lg shadow-sky-500/30 scale-[1.01]'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <span>Division 2</span>
                </button>
              </div>

              <button
                onClick={() => handleDownloadImage(showcaseRef, `Lineup_${showcaseSubTab}`)}
                disabled={isDownloading}
                className="w-full sm:w-auto bg-sky-500 hover:bg-sky-400 text-slate-950 font-black px-6 py-3 rounded-2xl text-xs transition flex items-center justify-center gap-2 shadow-lg shadow-sky-500/20 disabled:opacity-50"
              >
                <span>{isDownloading ? 'กำลังสร้างรูป...' : `ดาวน์โหลดรูปไลน์อัพ (${showcaseSubTab})`}</span>
              </button>
            </div>

            <div ref={showcaseRef} className="bg-slate-950 p-4 sm:p-6 rounded-2xl border border-slate-800 space-y-4">
              <div className="text-center pb-2 border-b border-slate-800/80">
                <h3 className="text-lg font-black text-sky-400 tracking-wider">
                  CONYSWEETxiSOTOPE LEAGUE - LINEUP {showcaseSubTab}
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">Official Team Roster Showcase</p>
              </div>

              {showcaseSubTab === 'D1' ? (
                <div className="space-y-4 pt-2">
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                    {sortedTeamsD1ByName.map((team, idx) => (
                      <div
                        key={team.id}
                        onClick={() => handleOpenShowcaseTeamModal(team)}
                        className="relative overflow-hidden bg-slate-900 border border-slate-800/90 rounded-2xl p-5 flex flex-col items-center text-center gap-4 shadow-xl group cursor-pointer"
                      >
                        {team.logo_url && (
                          <div className="absolute inset-0 flex items-center justify-center opacity-10 pointer-events-none overflow-hidden scale-125">
                            <img src={team.logo_url} alt="" className="w-full h-full object-cover blur-[1px]" />
                          </div>
                        )}

                        <span className="absolute top-3 left-3 text-xs font-black text-sky-400/90 bg-sky-500/10 px-2.5 py-1 rounded-lg border border-sky-500/20">
                          #{idx + 1}
                        </span>

                        <div className="relative z-10 w-24 h-24 rounded-2xl bg-slate-950 border border-sky-500/30 flex items-center justify-center overflow-hidden shrink-0 shadow-xl mt-2">
                          {team.logo_url ? (
                            <img src={team.logo_url} alt={team.team_name} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-4xl font-black text-sky-400">{team.team_name.charAt(0)}</span>
                          )}
                        </div>

                        <div className="relative z-10 min-w-0 w-full bg-slate-950/70 backdrop-blur-sm rounded-xl py-2 px-2 border border-slate-800/80">
                          <h4 className="font-extrabold text-slate-100 text-sm truncate w-full tracking-wide" title={team.team_name}>
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
                        className="relative overflow-hidden bg-slate-900 border border-slate-800/90 rounded-xl p-3.5 flex flex-col items-center text-center gap-3 shadow-xl group cursor-pointer"
                      >
                        {team.logo_url && (
                          <div className="absolute inset-0 flex items-center justify-center opacity-10 pointer-events-none overflow-hidden scale-125">
                            <img src={team.logo_url} alt="" className="w-full h-full object-cover blur-[1px]" />
                          </div>
                        )}

                        <span className="absolute top-2 left-2.5 text-[10px] font-black text-sky-400/80 bg-sky-500/10 px-1.5 py-0.5 rounded border border-sky-500/20">
                          #{idx + 1}
                        </span>

                        <div className="relative z-10 w-16 h-16 rounded-xl bg-slate-950 border border-sky-500/30 flex items-center justify-center overflow-hidden shrink-0 shadow-lg">
                          {team.logo_url ? (
                            <img src={team.logo_url} alt={team.team_name} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-2xl font-black text-sky-400">{team.team_name.charAt(0)}</span>
                          )}
                        </div>

                        <div className="relative z-10 min-w-0 w-full bg-slate-950/60 backdrop-blur-sm rounded-lg py-1 px-1 border border-slate-800/80">
                          <h4 className="font-bold text-slate-100 text-xs truncate w-full tracking-wide" title={team.team_name}>
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
          </div>
        ) : activeTab === 'match' && isAdmin ? (
          <div className="bg-slate-900/90 backdrop-blur-md border border-sky-500/30 rounded-2xl p-6 shadow-xl space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h2 className="text-xl font-bold text-sky-400 flex items-center gap-2">
                  <span>กรอกคะแนน (Batch Input)</span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">เลือกซีซั่น, เกม, แผนที่ และดิวิชันที่ต้องการกรอกคะแนนเรียงตามตัวอักษร</p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 font-semibold">ซีซั่น:</span>
                  <select
                    value={batchSeasonTarget}
                    onChange={(e) => setBatchSeasonTarget(e.target.value)}
                    className="bg-slate-950 border border-sky-500/50 rounded-xl px-3 py-2 text-xs text-sky-300 font-bold focus:outline-none"
                  >
                    <option value="current">ซีซั่นปัจจุบัน (Current)</option>
                    {historySeasons.map((s) => (
                      <option key={s.id} value={s.id}>{s.season_name}</option>
                    ))}
                  </select>
                </div>
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

            {/* ปุ่มเลือกสลับดิวิชันแบบขยายใหญ่เต็มตา */}
            <div className="flex bg-slate-950 border border-slate-800 rounded-2xl p-2 w-full gap-3 shadow-inner">
              <button
                type="button"
                onClick={() => setBatchDivisionTab('D1')}
                className={`py-4 px-8 rounded-xl text-base font-black transition-all flex-1 shadow-md ${
                  batchDivisionTab === 'D1'
                    ? 'bg-sky-500 text-slate-950 shadow-sky-500/30 scale-[1.01]'
                    : 'text-slate-400 hover:text-slate-200 bg-slate-900/60'
                }`}
              >
                Division 1
              </button>
              <button
                type="button"
                onClick={() => setBatchDivisionTab('D2')}
                className={`py-4 px-8 rounded-xl text-base font-black transition-all flex-1 shadow-md ${
                  batchDivisionTab === 'D2'
                    ? 'bg-sky-500 text-slate-950 shadow-sky-500/30 scale-[1.01]'
                    : 'text-slate-400 hover:text-slate-200 bg-slate-900/60'
                }`}
              >
                Division 2
              </button>
            </div>

            <form onSubmit={handleSaveAllBatchScores} className="space-y-6">
              {batchDivisionTab === 'D1' ? (
                <div className="space-y-4">
                  <h3 className="font-bold text-sky-400 text-sm">Division 1 (16 ทีม - แยกฝั่งซ้าย/ขวา)</h3>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* ฝั่งซ้าย D1 (1-8) */}
                    <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
                      <div className="text-xs font-extrabold text-sky-400 uppercase border-b border-slate-800 pb-2">ซ้าย: ทีมที่ 1 - 8</div>
                      <table className="w-full text-left text-sm">
                        <thead>
                          <tr className="border-b border-slate-800 text-slate-300 text-xs">
                            <th className="py-2.5 px-2">ชื่อทีม</th>
                            <th className="py-2.5 px-2 text-center w-20">อันดับ</th>
                            <th className="py-2.5 px-2 text-center w-20">คิล</th>
                            <th className="py-2.5 px-2 text-center w-16">WWCD</th>
                          </tr>
                        </thead>
                        <tbody>
                          {currentBatchTeams.d1.slice(0, 8).map((team) => {
                            const teamKey = String(team.id || team.team_name);
                            return (
                              <tr key={teamKey} className="border-b border-slate-900/60">
                                <td className="py-3 px-2 font-bold text-slate-100 text-sm truncate max-w-[140px]">{team.team_name}</td>
                                <td className="py-3 px-2 text-center">
                                  <input
                                    type="number"
                                    min="1"
                                    max="16"
                                    value={batchInputs[teamKey]?.place || ''}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setBatchInputs((prev) => ({
                                        ...prev,
                                        [teamKey]: { ...(prev[teamKey] || { kills: '', wwcd: false }), place: val },
                                      }));
                                    }}
                                    placeholder="อันดับ"
                                    className="w-16 bg-slate-900 border border-slate-700 rounded-xl px-2 py-2 text-center text-xs font-bold text-slate-100 focus:border-sky-400 focus:outline-none shadow-inner"
                                  />
                                </td>
                                <td className="py-3 px-2 text-center">
                                  <input
                                    type="number"
                                    min="0"
                                    value={batchInputs[teamKey]?.kills || ''}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setBatchInputs((prev) => ({
                                        ...prev,
                                        [teamKey]: { ...(prev[teamKey] || { place: '', wwcd: false }), kills: val },
                                      }));
                                    }}
                                    placeholder="คิล"
                                    className="w-16 bg-slate-900 border border-slate-700 rounded-xl px-2 py-2 text-center text-xs font-bold text-slate-100 focus:border-sky-400 focus:outline-none shadow-inner"
                                  />
                                </td>
                                <td className="py-3 px-2 text-center">
                                  <input
                                    type="checkbox"
                                    checked={batchInputs[teamKey]?.wwcd || false}
                                    onChange={(e) => {
                                      const checked = e.target.checked;
                                      setBatchInputs((prev) => ({
                                        ...prev,
                                        [teamKey]: { ...(prev[teamKey] || { place: '', kills: '' }), wwcd: checked },
                                      }));
                                    }}
                                    className="w-5 h-5 rounded bg-slate-900 border-slate-700 text-sky-500 cursor-pointer accent-sky-500"
                                  />
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* ฝั่งขวา D1 (9-16) */}
                    <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
                      <div className="text-xs font-extrabold text-sky-400 uppercase border-b border-slate-800 pb-2">ขวา: ทีมที่ 9 - 16</div>
                      <table className="w-full text-left text-sm">
                        <thead>
                          <tr className="border-b border-slate-800 text-slate-300 text-xs">
                            <th className="py-2.5 px-2">ชื่อทีม</th>
                            <th className="py-2.5 px-2 text-center w-20">อันดับ</th>
                            <th className="py-2.5 px-2 text-center w-20">คิล</th>
                            <th className="py-2.5 px-2 text-center w-16">WWCD</th>
                          </tr>
                        </thead>
                        <tbody>
                          {currentBatchTeams.d1.slice(8, 16).map((team) => {
                            const teamKey = String(team.id || team.team_name);
                            return (
                              <tr key={teamKey} className="border-b border-slate-900/60">
                                <td className="py-3 px-2 font-bold text-slate-100 text-sm truncate max-w-[140px]">{team.team_name}</td>
                                <td className="py-3 px-2 text-center">
                                  <input
                                    type="number"
                                    min="1"
                                    max="16"
                                    value={batchInputs[teamKey]?.place || ''}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setBatchInputs((prev) => ({
                                        ...prev,
                                        [teamKey]: { ...(prev[teamKey] || { kills: '', wwcd: false }), place: val },
                                      }));
                                    }}
                                    placeholder="อันดับ"
                                    className="w-16 bg-slate-900 border border-slate-700 rounded-xl px-2 py-2 text-center text-xs font-bold text-slate-100 focus:border-sky-400 focus:outline-none shadow-inner"
                                  />
                                </td>
                                <td className="py-3 px-2 text-center">
                                  <input
                                    type="number"
                                    min="0"
                                    value={batchInputs[teamKey]?.kills || ''}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setBatchInputs((prev) => ({
                                        ...prev,
                                        [teamKey]: { ...(prev[teamKey] || { place: '', wwcd: false }), kills: val },
                                      }));
                                    }}
                                    placeholder="คิล"
                                    className="w-16 bg-slate-900 border border-slate-700 rounded-xl px-2 py-2 text-center text-xs font-bold text-slate-100 focus:border-sky-400 focus:outline-none shadow-inner"
                                  />
                                </td>
                                <td className="py-3 px-2 text-center">
                                  <input
                                    type="checkbox"
                                    checked={batchInputs[teamKey]?.wwcd || false}
                                    onChange={(e) => {
                                      const checked = e.target.checked;
                                      setBatchInputs((prev) => ({
                                        ...prev,
                                        [teamKey]: { ...(prev[teamKey] || { place: '', kills: '' }), wwcd: checked },
                                      }));
                                    }}
                                    className="w-5 h-5 rounded bg-slate-900 border-slate-700 text-sky-500 cursor-pointer accent-sky-500"
                                  />
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <h3 className="font-bold text-slate-300 text-sm">Division 2 (20 ทีม - แยกฝั่งซ้าย/ขวา)</h3>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* ฝั่งซ้าย D2 (1-10) */}
                    <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
                      <div className="text-xs font-extrabold text-slate-300 uppercase border-b border-slate-800 pb-2">ซ้าย: ทีมที่ 1 - 10</div>
                      <table className="w-full text-left text-sm">
                        <thead>
                          <tr className="border-b border-slate-800 text-slate-300 text-xs">
                            <th className="py-2.5 px-2">ชื่อทีม</th>
                            <th className="py-2.5 px-2 text-center w-20">อันดับ</th>
                            <th className="py-2.5 px-2 text-center w-20">คิล</th>
                            <th className="py-2.5 px-2 text-center w-16">WWCD</th>
                          </tr>
                        </thead>
                        <tbody>
                          {currentBatchTeams.d2.slice(0, 10).map((team) => {
                            const teamKey = String(team.id || team.team_name);
                            return (
                              <tr key={teamKey} className="border-b border-slate-900/60">
                                <td className="py-3 px-2 font-bold text-slate-100 text-sm truncate max-w-[140px]">{team.team_name}</td>
                                <td className="py-3 px-2 text-center">
                                  <input
                                    type="number"
                                    min="1"
                                    max="20"
                                    value={batchInputs[teamKey]?.place || ''}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setBatchInputs((prev) => ({
                                        ...prev,
                                        [teamKey]: { ...(prev[teamKey] || { kills: '', wwcd: false }), place: val },
                                      }));
                                    }}
                                    placeholder="อันดับ"
                                    className="w-16 bg-slate-900 border border-slate-700 rounded-xl px-2 py-2 text-center text-xs font-bold text-slate-100 focus:border-sky-400 focus:outline-none shadow-inner"
                                  />
                                </td>
                                <td className="py-3 px-2 text-center">
                                  <input
                                    type="number"
                                    min="0"
                                    value={batchInputs[teamKey]?.kills || ''}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setBatchInputs((prev) => ({
                                        ...prev,
                                        [teamKey]: { ...(prev[teamKey] || { place: '', wwcd: false }), kills: val },
                                      }));
                                    }}
                                    placeholder="คิล"
                                    className="w-16 bg-slate-900 border border-slate-700 rounded-xl px-2 py-2 text-center text-xs font-bold text-slate-100 focus:border-sky-400 focus:outline-none shadow-inner"
                                  />
                                </td>
                                <td className="py-3 px-2 text-center">
                                  <input
                                    type="checkbox"
                                    checked={batchInputs[teamKey]?.wwcd || false}
                                    onChange={(e) => {
                                      const checked = e.target.checked;
                                      setBatchInputs((prev) => ({
                                        ...prev,
                                        [teamKey]: { ...(prev[teamKey] || { place: '', kills: '' }), wwcd: checked },
                                      }));
                                    }}
                                    className="w-5 h-5 rounded bg-slate-900 border-slate-700 text-sky-500 cursor-pointer accent-sky-500"
                                  />
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* ฝั่งขวา D2 (11-20) */}
                    <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
                      <div className="text-xs font-extrabold text-slate-300 uppercase border-b border-slate-800 pb-2">ขวา: ทีมที่ 11 - 20</div>
                      <table className="w-full text-left text-sm">
                        <thead>
                          <tr className="border-b border-slate-800 text-slate-300 text-xs">
                            <th className="py-2.5 px-2">ชื่อทีม</th>
                            <th className="py-2.5 px-2 text-center w-20">อันดับ</th>
                            <th className="py-2.5 px-2 text-center w-20">คิล</th>
                            <th className="py-2.5 px-2 text-center w-16">WWCD</th>
                          </tr>
                        </thead>
                        <tbody>
                          {currentBatchTeams.d2.slice(10, 20).map((team) => {
                            const teamKey = String(team.id || team.team_name);
                            return (
                              <tr key={teamKey} className="border-b border-slate-900/60">
                                <td className="py-3 px-2 font-bold text-slate-100 text-sm truncate max-w-[140px]">{team.team_name}</td>
                                <td className="py-3 px-2 text-center">
                                  <input
                                    type="number"
                                    min="1"
                                    max="20"
                                    value={batchInputs[teamKey]?.place || ''}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setBatchInputs((prev) => ({
                                        ...prev,
                                        [teamKey]: { ...(prev[teamKey] || { kills: '', wwcd: false }), place: val },
                                      }));
                                    }}
                                    placeholder="อันดับ"
                                    className="w-16 bg-slate-900 border border-slate-700 rounded-xl px-2 py-2 text-center text-xs font-bold text-slate-100 focus:border-sky-400 focus:outline-none shadow-inner"
                                  />
                                </td>
                                <td className="py-3 px-2 text-center">
                                  <input
                                    type="number"
                                    min="0"
                                    value={batchInputs[teamKey]?.kills || ''}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setBatchInputs((prev) => ({
                                        ...prev,
                                        [teamKey]: { ...(prev[teamKey] || { place: '', wwcd: false }), kills: val },
                                      }));
                                    }}
                                    placeholder="คิล"
                                    className="w-16 bg-slate-900 border border-slate-700 rounded-xl px-2 py-2 text-center text-xs font-bold text-slate-100 focus:border-sky-400 focus:outline-none shadow-inner"
                                  />
                                </td>
                                <td className="py-3 px-2 text-center">
                                  <input
                                    type="checkbox"
                                    checked={batchInputs[teamKey]?.wwcd || false}
                                    onChange={(e) => {
                                      const checked = e.target.checked;
                                      setBatchInputs((prev) => ({
                                        ...prev,
                                        [teamKey]: { ...(prev[teamKey] || { place: '', kills: '' }), wwcd: checked },
                                      }));
                                    }}
                                    className="w-5 h-5 rounded bg-slate-900 border-slate-700 text-sky-500 cursor-pointer accent-sky-500"
                                  />
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={processing}
                className="w-full bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold py-3.5 px-6 rounded-xl text-sm transition shadow-lg disabled:opacity-50"
              >
                {processing ? 'กำลังบันทึกคะแนน...' : `บันทึกคะแนน ${batchDivisionTab} เกมที่ ${batchGameNumber} ทันที`}
              </button>
            </form>
          </div>
        ) : activeTab === 'halloffame' ? (
          <div className="bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-2xl p-8 shadow-xl space-y-8">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex bg-slate-950 border border-slate-800 rounded-2xl p-1.5 w-full md:w-auto shadow-inner">
                <button
                  onClick={() => { setHallOfFameSubTab('all'); setHallOfFamePage(1); }}
                  className={`py-2.5 px-5 rounded-xl text-xs font-black transition-all ${
                    hallOfFameSubTab === 'all'
                      ? 'bg-sky-500 text-slate-950 shadow-md'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  รวมทั้งหมด (All-Time)
                </button>
                <button
                  onClick={() => { setHallOfFameSubTab('D1'); setHallOfFamePage(1); }}
                  className={`py-2.5 px-5 rounded-xl text-xs font-black transition-all ${
                    hallOfFameSubTab === 'D1'
                      ? 'bg-sky-500 text-slate-950 shadow-md'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Division 1
                </button>
                <button
                  onClick={() => { setHallOfFameSubTab('D2'); setHallOfFamePage(1); }}
                  className={`py-2.5 px-5 rounded-xl text-xs font-black transition-all ${
                    hallOfFameSubTab === 'D2'
                      ? 'bg-sky-500 text-slate-950 shadow-md'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Division 2
                </button>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
                <input
                  type="text"
                  value={hallOfFameSearch}
                  onChange={(e) => { setHallOfFameSearch(e.target.value); setHallOfFamePage(1); }}
                  placeholder="พิมพ์ชื่อทีมเพื่อค้นหา..."
                  className="w-full sm:w-64 bg-slate-950 border border-sky-500/40 rounded-xl px-4 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-400"
                />
                <button
                  onClick={() => handleDownloadImage(hallOfFameRef, `Hall_Of_Fame_${hallOfFameSubTab}_Page_${hallOfFamePage}`)}
                  disabled={isDownloading}
                  className="w-full sm:w-auto bg-sky-500 hover:bg-sky-400 text-slate-950 font-black px-5 py-2.5 rounded-xl text-xs transition flex items-center justify-center gap-2 shadow-lg shadow-sky-500/20 disabled:opacity-50 shrink-0"
                >
                  <span>{isDownloading ? 'กำลังสร้างรูป...' : `ดาวน์โหลดรูปหน้านี้ (หน้า ${hallOfFamePage})`}</span>
                </button>
              </div>
            </div>

            <div ref={hallOfFameRef} className="bg-slate-950 p-6 rounded-2xl border border-slate-800/80 space-y-6">
              <div className="text-center pb-2 border-b border-slate-800/80">
                <h2 className="text-2xl font-black text-sky-400 tracking-wider">
                  HALL OF FAME ({hallOfFameSubTab === 'all' ? 'ALL-TIME' : hallOfFameSubTab})
                </h2>
                <p className="text-[11px] text-slate-500 mt-0.5">League Legends & Statistics Showcase (แสดงหน้าละ 12 ทีม)</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {paginatedHofData.map((team, idx) => {
                  const globalIdx = (hallOfFamePage - 1) * itemsPerPage + idx;
                  const displayWWCD = hallOfFameSubTab === 'D1' ? (team.d1WWCD || 0) : hallOfFameSubTab === 'D2' ? (team.d2WWCD || 0) : (team.totalWWCD || 0);
                  const displayPoints = hallOfFameSubTab === 'D1' ? (team.d1Points || 0) : hallOfFameSubTab === 'D2' ? (team.d2Points || 0) : (team.totalPointsAllTime || 0);

                  return (
                    <div
                      key={globalIdx}
                      onClick={() => handleOpenHistoryTeamModal(team, hallOfFameSubTab === 'all' ? 'Hall of Fame' : hallOfFameSubTab)}
                      className="relative overflow-hidden bg-slate-900 border border-slate-800 hover:border-sky-500/60 rounded-2xl p-5 transition-all duration-300 shadow-xl flex items-center justify-between gap-4 group cursor-pointer hover:scale-[1.01]"
                    >
                      {team.logo_url && (
                        <div className="absolute inset-0 flex items-center justify-center opacity-10 pointer-events-none overflow-hidden scale-125 group-hover:scale-150 transition duration-500">
                          <img src={team.logo_url} alt="" className="w-full h-full object-cover blur-[2px]" />
                        </div>
                      )}

                      <div className="relative z-10 flex items-center gap-3.5 min-w-0">
                        <div className="w-14 h-14 rounded-xl bg-slate-950 border border-sky-500/30 flex items-center justify-center overflow-hidden shrink-0 shadow-md">
                          {team.logo_url ? (
                            <img src={team.logo_url} alt={team.team_name} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-2xl font-black text-sky-400">{team.team_name.charAt(0)}</span>
                          )}
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-sky-400 font-extrabold px-2 py-0.5 rounded bg-sky-500/10 border border-sky-500/20">
                              #{globalIdx + 1}
                            </span>
                            {hallOfFameSubTab === 'all' && team.d1Titles > 0 && (
                              <span className="text-[10px] bg-sky-500/20 border border-sky-500/40 text-sky-300 px-2 py-0.5 rounded font-bold">
                                {team.d1Titles} แชมป์
                              </span>
                            )}
                          </div>
                          <h3 className="font-bold text-slate-100 group-hover:text-sky-300 transition text-sm truncate mt-1 w-full" title={team.team_name}>
                            {team.team_name}
                          </h3>
                        </div>
                      </div>

                      <div className="relative z-10 text-right shrink-0 bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-2">
                        <div className="text-[10px] text-slate-400 font-medium">ไก่: <span className="font-bold text-sky-400">{displayWWCD}</span></div>
                        <div className="text-[10px] text-slate-400 font-medium mt-0.5">แต้ม: <span className="font-bold text-sky-300">{displayPoints}</span></div>
                      </div>
                    </div>
                  );
                })}
                {paginatedHofData.length === 0 && (
                  <div className="col-span-full text-center py-16 text-slate-500 text-sm">
                    ไม่พบข้อมูลทีมในหมวดหมู่นี้
                  </div>
                )}
              </div>

              {totalHofPages > 1 && (
                <div className="flex items-center justify-center gap-2 pt-4 border-t border-slate-800">
                  <button
                    onClick={() => setHallOfFamePage((prev) => Math.max(prev - 1, 1))}
                    disabled={hallOfFamePage === 1}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-900 border border-slate-800 text-slate-300 hover:border-sky-500 disabled:opacity-30 disabled:hover:border-slate-850 transition"
                  >
                    ก่อนหน้า
                  </button>
                  <span className="text-xs font-bold text-sky-400 px-3">
                    หน้า {hallOfFamePage} จาก {totalHofPages}
                  </span>
                  <button
                    onClick={() => setHallOfFamePage((prev) => Math.min(prev + 1, totalHofPages))}
                    disabled={hallOfFamePage === totalHofPages}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-900 border border-slate-800 text-slate-300 hover:border-sky-500 disabled:opacity-30 disabled:hover:border-slate-850 transition"
                  >
                    ถัดไป
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : activeTab === 'latestseason' ? (
          <div className="bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pb-4 border-b border-slate-800">
              <div className="flex bg-slate-950 border border-slate-800 rounded-2xl p-1.5 w-full sm:w-auto shadow-inner">
                <button
                  onClick={() => setSelectedLatestDivision('D1')}
                  className={`py-3 px-8 rounded-xl text-sm font-black transition-all ${
                    selectedLatestDivision === 'D1'
                      ? 'bg-sky-500 text-slate-950 shadow-md'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Division 1
                </button>
                <button
                  onClick={() => setSelectedLatestDivision('D2')}
                  className={`py-3 px-8 rounded-xl text-sm font-black transition-all ${
                    selectedLatestDivision === 'D2'
                      ? 'bg-sky-500 text-slate-950 shadow-md'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Division 2
                </button>
              </div>

              <button
                onClick={() => handleDownloadImage(latestInlineRef, `Leaderboard_${selectedLatestDivision}`)}
                disabled={isDownloading}
                className="w-full sm:w-auto bg-sky-500 hover:bg-sky-400 text-slate-950 font-black px-6 py-3 rounded-xl text-xs transition flex items-center justify-center gap-2 shadow-lg shadow-sky-500/20 disabled:opacity-50"
              >
                <span>{isDownloading ? 'กำลังสร้างรูป...' : `ดาวน์โหลดรูปตาราง (${selectedLatestDivision})`}</span>
              </button>
            </div>

            <div ref={latestInlineRef} className="relative overflow-hidden bg-slate-950 p-6 rounded-2xl border border-slate-800 space-y-4">
              {currentBgUrl && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
                  <img src={currentBgUrl} alt="" className="w-[360px] h-auto object-contain opacity-[0.22] blur-[0.5px]" />
                </div>
              )}
              
              <div className="relative z-10 space-y-4">
                <div className="text-center pb-2 border-b border-slate-800/80">
                  <h4 className="text-lg font-black text-sky-400 tracking-wider">
                    CONYSWEETxiSOTOPE - {selectedLatestDivision === 'D1' ? 'DIVISION 1' : 'DIVISION 2'}
                  </h4>
                  <p className="text-[10px] text-slate-500 mt-0.5">Official Standings Showcase</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {selectedLatestDivision === 'D1' ? (
                    <>
                      <div className="bg-slate-900/30 backdrop-blur-sm border border-slate-800 rounded-xl p-4 space-y-2">
                        <div className="text-xs font-extrabold text-sky-400 uppercase tracking-wide border-b border-slate-800 pb-2">Top 1 - 8</div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs">
                            <thead>
                              <tr className="text-slate-400 border-b border-slate-800/80">
                                <th className="py-2.5 px-2 w-10">#</th>
                                <th className="py-2.5 px-3">ทีม</th>
                                <th className="py-2.5 px-2 text-center w-12">ไก่</th>
                                <th className="py-2.5 px-2 text-right w-16">แต้ม</th>
                              </tr>
                            </thead>
                            <tbody>
                              {teamsD1.slice(0, 8).map((team, idx) => (
                                <tr key={team.id} className="border-b border-slate-800/40 cursor-pointer hover:bg-slate-800/30" onClick={() => handleOpenTeamDetailModal(team)}>
                                  <td className="py-3 px-2 font-bold text-sky-400">{idx + 1}</td>
                                  <td className="py-3 px-3 font-semibold text-slate-200">
                                    <div className="flex items-center gap-2.5">
                                      <div className="w-8 h-8 rounded-lg bg-slate-950 border border-sky-500/30 flex items-center justify-center overflow-hidden shrink-0 shadow">
                                        {team.logo_url ? (
                                          <img src={team.logo_url} alt="" className="w-full h-full object-cover" />
                                        ) : (
                                          <span className="text-[11px] font-bold text-sky-400">{team.team_name.charAt(0)}</span>
                                        )}
                                      </div>
                                      <span className="truncate max-w-[150px]">{team.team_name}</span>
                                    </div>
                                  </td>
                                  <td className="py-3 px-2 text-center font-bold text-sky-400">{team.wwcd || 0}</td>
                                  <td className="py-3 px-2 text-right font-extrabold text-sky-300">{team.total_points || 0}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      <div className="bg-slate-900/30 backdrop-blur-sm border border-slate-800 rounded-xl p-4 space-y-2">
                        <div className="text-xs font-extrabold text-sky-400 uppercase tracking-wide border-b border-slate-800 pb-2">Top 9 - 16</div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs">
                            <thead>
                              <tr className="text-slate-400 border-b border-slate-800/80">
                                <th className="py-2.5 px-2 w-10">#</th>
                                <th className="py-2.5 px-3">ทีม</th>
                                <th className="py-2.5 px-2 text-center w-12">ไก่</th>
                                <th className="py-2.5 px-2 text-right w-16">แต้ม</th>
                              </tr>
                            </thead>
                            <tbody>
                              {teamsD1.slice(8, 16).map((team, idx) => (
                                <tr key={team.id} className="border-b border-slate-800/40 cursor-pointer hover:bg-slate-800/30" onClick={() => handleOpenTeamDetailModal(team)}>
                                  <td className="py-3 px-2 font-bold text-sky-400">{idx + 9}</td>
                                  <td className="py-3 px-3 font-semibold text-slate-200">
                                    <div className="flex items-center gap-2.5">
                                      <div className="w-8 h-8 rounded-lg bg-slate-950 border border-sky-500/30 flex items-center justify-center overflow-hidden shrink-0 shadow">
                                        {team.logo_url ? (
                                          <img src={team.logo_url} alt="" className="w-full h-full object-cover" />
                                        ) : (
                                          <span className="text-[11px] font-bold text-sky-400">{team.team_name.charAt(0)}</span>
                                        )}
                                      </div>
                                      <span className="truncate max-w-[150px]">{team.team_name}</span>
                                    </div>
                                  </td>
                                  <td className="py-3 px-2 text-center font-bold text-sky-400">{team.wwcd || 0}</td>
                                  <td className="py-3 px-2 text-right font-extrabold text-sky-300">{team.total_points || 0}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="bg-slate-900/30 backdrop-blur-sm border border-slate-800 rounded-xl p-4 space-y-2">
                        <div className="text-xs font-extrabold text-slate-300 uppercase tracking-wide border-b border-slate-800 pb-2">Top 1 - 10</div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs">
                            <thead>
                              <tr className="text-slate-400 border-b border-slate-800/80">
                                <th className="py-2.5 px-2 w-10">#</th>
                                <th className="py-2.5 px-3">ทีม</th>
                                <th className="py-2.5 px-2 text-center w-12">ไก่</th>
                                <th className="py-2.5 px-2 text-right w-16">แต้ม</th>
                              </tr>
                            </thead>
                            <tbody>
                              {teamsD2.slice(0, 10).map((team, idx) => (
                                <tr key={team.id} className="border-b border-slate-800/40 cursor-pointer hover:bg-slate-800/30" onClick={() => handleOpenTeamDetailModal(team)}>
                                  <td className="py-3 px-2 font-bold text-slate-400">{idx + 1}</td>
                                  <td className="py-3 px-3 font-semibold text-slate-200">
                                    <div className="flex items-center gap-2.5">
                                      <div className="w-8 h-8 rounded-lg bg-slate-950 border border-slate-700 flex items-center justify-center overflow-hidden shrink-0 shadow">
                                        {team.logo_url ? (
                                          <img src={team.logo_url} alt="" className="w-full h-full object-cover" />
                                        ) : (
                                          <span className="text-[11px] font-bold text-slate-400">{team.team_name.charAt(0)}</span>
                                        )}
                                      </div>
                                      <span className="truncate max-w-[150px]">{team.team_name}</span>
                                    </div>
                                  </td>
                                  <td className="py-3 px-2 text-center font-bold text-slate-400">{team.wwcd || 0}</td>
                                  <td className="py-3 px-2 text-right font-extrabold text-slate-200">{team.total_points || 0}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      <div className="bg-slate-900/30 backdrop-blur-sm border border-slate-800 rounded-xl p-4 space-y-2">
                        <div className="text-xs font-extrabold text-slate-300 uppercase tracking-wide border-b border-slate-800 pb-2">Top 11 - 20</div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs">
                            <thead>
                              <tr className="text-slate-400 border-b border-slate-800/80">
                                <th className="py-2.5 px-2 w-10">#</th>
                                <th className="py-2.5 px-3">ทีม</th>
                                <th className="py-2.5 px-2 text-center w-12">ไก่</th>
                                <th className="py-2.5 px-2 text-right w-16">แต้ม</th>
                              </tr>
                            </thead>
                            <tbody>
                              {teamsD2.slice(10, 20).map((team, idx) => (
                                <tr key={team.id} className="border-b border-slate-800/40 cursor-pointer hover:bg-slate-800/30" onClick={() => handleOpenTeamDetailModal(team)}>
                                  <td className="py-3 px-2 font-bold text-slate-400">{idx + 11}</td>
                                  <td className="py-3 px-3 font-semibold text-slate-200">
                                    <div className="flex items-center gap-2.5">
                                      <div className="w-8 h-8 rounded-lg bg-slate-950 border border-slate-700 flex items-center justify-center overflow-hidden shrink-0 shadow">
                                        {team.logo_url ? (
                                          <img src={team.logo_url} alt="" className="w-full h-full object-cover" />
                                        ) : (
                                          <span className="text-[11px] font-bold text-slate-400">{team.team_name.charAt(0)}</span>
                                        )}
                                      </div>
                                      <span className="truncate max-w-[150px]">{team.team_name}</span>
                                    </div>
                                  </td>
                                  <td className="py-3 px-2 text-center font-bold text-slate-400">{team.wwcd || 0}</td>
                                  <td className="py-3 px-2 text-right font-extrabold text-slate-200">{team.total_points || 0}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : activeTab === 'history' ? (
          <div className="bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-2xl p-8 shadow-xl space-y-8">
            <div className="flex flex-col items-center justify-center text-center space-y-4">
              <h2 className="text-3xl font-black text-sky-400 tracking-wider">ซีซั่นทั้งหมด</h2>

              <div className="flex flex-col sm:flex-row items-center gap-3 w-full max-w-xl justify-center">
                <div className="flex items-center gap-2 w-full">
                  <span className="text-xs text-slate-400 font-semibold shrink-0">เลือกซีซั่น:</span>
                  <select
                    value={selectedSeason?.id || ''}
                    onChange={(e) => {
                      const found = historySeasons.find((s) => s.id === Number(e.target.value));
                      if (found) {
                        setSelectedSeason(found);
                        const d1Arr = (found.d1_snapshot || []).filter((t: any) => (t.total_points || 0) > 0 || (t.wwcd || 0) > 0 || (t.place_points || 0) > 0 || (t.kill_points || 0) > 0);
                        const d2Arr = (found.d2_snapshot || []).filter((t: any) => (t.total_points || 0) > 0 || (t.wwcd || 0) > 0 || (t.place_points || 0) > 0 || (t.kill_points || 0) > 0);
                        if (d1Arr.length === 0 && d2Arr.length > 0) {
                          setHistoryDivisionTab('D2');
                        } else {
                          setHistoryDivisionTab('D1');
                        }
                      }
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

                <button
                  onClick={() => handleDownloadImage(historyRef, `Season_History_${selectedSeason?.season_name || 'All'}_${historyDivisionTab}`)}
                  disabled={isDownloading || !selectedSeason}
                  className="w-full sm:w-auto bg-sky-500 hover:bg-sky-400 text-slate-950 font-black px-5 py-3 rounded-2xl text-xs transition flex items-center justify-center gap-1.5 shadow-lg shadow-sky-500/20 disabled:opacity-50 shrink-0"
                >
                  <span>{isDownloading ? 'กำลังสร้างรูป...' : `ดาวน์โหลดรูป (${historyDivisionTab})`}</span>
                </button>
              </div>

              {(hasHistoryD1 || hasHistoryD2) && (
                <div className="flex bg-slate-950 border border-slate-800 rounded-2xl p-1.5 w-full sm:w-auto shadow-inner">
                  {hasHistoryD1 && (
                    <button
                      onClick={() => setHistoryDivisionTab('D1')}
                      className={`py-2.5 px-8 rounded-xl text-xs font-black transition-all ${
                        historyDivisionTab === 'D1'
                          ? 'bg-sky-500 text-slate-950 shadow-md'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Division 1
                    </button>
                  )}
                  {hasHistoryD2 && (
                    <button
                      onClick={() => setHistoryDivisionTab('D2')}
                      className={`py-2.5 px-8 rounded-xl text-xs font-black transition-all ${
                        historyDivisionTab === 'D2'
                          ? 'bg-sky-500 text-slate-950 shadow-md'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Division 2
                    </button>
                  )}
                </div>
              )}
            </div>

            {selectedSeason ? (
              <div ref={historyRef} className="relative overflow-hidden bg-slate-950 p-6 rounded-2xl border border-slate-800 space-y-4">
                {currentBgUrl && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
                    <img src={currentBgUrl} alt="" className="w-[360px] h-auto object-contain opacity-[0.22] blur-[0.5px]" />
                  </div>
                )}

                <div className="relative z-10 space-y-4">
                  <div className="text-center pb-2 border-b border-slate-800/80">
                    <h4 className="text-lg font-black text-sky-400 tracking-wider">
                      {selectedSeason.season_name} - {historyDivisionTab === 'D1' ? 'DIVISION 1' : 'DIVISION 2'}
                    </h4>
                    <p className="text-[10px] text-slate-500 mt-0.5">Historical Standings Showcase</p>
                  </div>

                  {historyDivisionTab === 'D1' ? (
                    filteredHistoryD1.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-slate-900/30 backdrop-blur-sm border border-slate-800 rounded-xl p-4 space-y-2">
                          <div className="text-xs font-extrabold text-sky-400 uppercase tracking-wide border-b border-slate-800 pb-2">Top 1 - 8</div>
                          <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                              <thead>
                                <tr className="text-slate-400 border-b border-slate-800/80">
                                  <th className="py-2.5 px-2 w-10">#</th>
                                  <th className="py-2.5 px-3">ทีม</th>
                                  <th className="py-2.5 px-2 text-center w-12">ไก่</th>
                                  <th className="py-2.5 px-2 text-right w-16">แต้ม</th>
                                </tr>
                              </thead>
                              <tbody>
                                {filteredHistoryD1.slice(0, 8).map((t: any, idx: number) => {
                                  const key = (t.team_name || '').trim().toLowerCase();
                                  const hofMatch = hallOfFameData.find((h) => (h.team_name || '').trim().toLowerCase() === key);
                                  const teamDataToPass = hofMatch || {
                                    team_name: t.team_name,
                                    logo_url: t.logo_url || '',
                                    totalWWCD: t.wwcd || 0,
                                    totalPlacePoints: t.place_points || 0,
                                    totalKillPoints: t.kill_points || 0,
                                    totalPointsAllTime: t.total_points || 0,
                                  };
                                  return (
                                    <tr 
                                      key={idx} 
                                      onClick={() => handleOpenHistoryTeamModal(teamDataToPass, 'Division 1')}
                                      className="border-b border-slate-800/40 cursor-pointer hover:bg-slate-800/30"
                                    >
                                      <td className="py-3 px-2 font-bold text-sky-400">{idx + 1}</td>
                                      <td className="py-3 px-3 font-semibold text-slate-200">
                                        <div className="flex items-center gap-2.5">
                                          <div className="w-8 h-8 rounded-lg bg-slate-950 border border-sky-500/30 flex items-center justify-center overflow-hidden shrink-0 shadow">
                                            {t.logo_url ? (
                                              <img src={t.logo_url} alt="" className="w-full h-full object-cover" />
                                            ) : (
                                              <span className="text-[11px] font-bold text-sky-400">{t.team_name.charAt(0)}</span>
                                            )}
                                          </div>
                                          <span className="truncate max-w-[150px]">{t.team_name}</span>
                                        </div>
                                      </td>
                                      <td className="py-3 px-2 text-center font-bold text-sky-400">{t.wwcd || 0}</td>
                                      <td className="py-3 px-2 text-right font-extrabold text-sky-300">{t.total_points || 0}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>

                        {filteredHistoryD1.length > 8 && (
                          <div className="bg-slate-900/30 backdrop-blur-sm border border-slate-800 rounded-xl p-4 space-y-2">
                            <div className="text-xs font-extrabold text-sky-400 uppercase tracking-wide border-b border-slate-800 pb-2">Top 9 - 16</div>
                            <div className="overflow-x-auto">
                              <table className="w-full text-left text-xs">
                                <thead>
                                  <tr className="text-slate-400 border-b border-slate-800/80">
                                    <th className="py-2.5 px-2 w-10">#</th>
                                    <th className="py-2.5 px-3">ทีม</th>
                                    <th className="py-2.5 px-2 text-center w-12">ไก่</th>
                                    <th className="py-2.5 px-2 text-right w-16">แต้ม</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {filteredHistoryD1.slice(8, 16).map((t: any, idx: number) => {
                                    const key = (t.team_name || '').trim().toLowerCase();
                                    const hofMatch = hallOfFameData.find((h) => (h.team_name || '').trim().toLowerCase() === key);
                                    const teamDataToPass = hofMatch || {
                                      team_name: t.team_name,
                                      logo_url: t.logo_url || '',
                                      totalWWCD: t.wwcd || 0,
                                      totalPlacePoints: t.place_points || 0,
                                      totalKillPoints: t.kill_points || 0,
                                      totalPointsAllTime: t.total_points || 0,
                                    };
                                    return (
                                      <tr 
                                        key={idx} 
                                        onClick={() => handleOpenHistoryTeamModal(teamDataToPass, 'Division 1')}
                                        className="border-b border-slate-800/40 cursor-pointer hover:bg-slate-800/30"
                                      >
                                        <td className="py-3 px-2 font-bold text-sky-400">{idx + 9}</td>
                                        <td className="py-3 px-3 font-semibold text-slate-200">
                                          <div className="flex items-center gap-2.5">
                                            <div className="w-8 h-8 rounded-lg bg-slate-950 border border-sky-500/30 flex items-center justify-center overflow-hidden shrink-0 shadow">
                                              {t.logo_url ? (
                                                <img src={t.logo_url} alt="" className="w-full h-full object-cover" />
                                              ) : (
                                                <span className="text-[11px] font-bold text-sky-400">{t.team_name.charAt(0)}</span>
                                              )}
                                            </div>
                                            <span className="truncate max-w-[150px]">{t.team_name}</span>
                                          </div>
                                        </td>
                                        <td className="py-3 px-2 text-center font-bold text-sky-400">{t.wwcd || 0}</td>
                                        <td className="py-3 px-2 text-right font-extrabold text-sky-300">{t.total_points || 0}</td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="bg-slate-900/30 backdrop-blur-sm border border-slate-800 rounded-xl p-12 text-center text-slate-500 text-xs">
                        ไม่มีข้อมูลทีมที่ลงแข่งขันใน Division 1 ของซีซั่นนี้
                      </div>
                    )
                  ) : (
                    filteredHistoryD2.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-slate-900/30 backdrop-blur-sm border border-slate-800 rounded-xl p-4 space-y-2">
                          <div className="text-xs font-extrabold text-slate-300 uppercase tracking-wide border-b border-slate-800 pb-2">Top 1 - 10</div>
                          <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                              <thead>
                                <tr className="text-slate-400 border-b border-slate-800/80">
                                  <th className="py-2.5 px-2 w-10">#</th>
                                  <th className="py-2.5 px-3">ทีม</th>
                                  <th className="py-2.5 px-2 text-center w-12">ไก่</th>
                                  <th className="py-2.5 px-2 text-right w-16">แต้ม</th>
                                </tr>
                              </thead>
                              <tbody>
                                {filteredHistoryD2.slice(0, 10).map((t: any, idx: number) => {
                                  const key = (t.team_name || '').trim().toLowerCase();
                                  const hofMatch = hallOfFameData.find((h) => (h.team_name || '').trim().toLowerCase() === key);
                                  const teamDataToPass = hofMatch || {
                                    team_name: t.team_name,
                                    logo_url: t.logo_url || '',
                                    totalWWCD: t.wwcd || 0,
                                    totalPlacePoints: t.place_points || 0,
                                    totalKillPoints: t.kill_points || 0,
                                    totalPointsAllTime: t.total_points || 0,
                                  };
                                  return (
                                    <tr 
                                      key={idx} 
                                      onClick={() => handleOpenHistoryTeamModal(teamDataToPass, 'Division 2')}
                                      className="border-b border-slate-800/40 cursor-pointer hover:bg-slate-800/30"
                                    >
                                      <td className="py-3 px-2 font-bold text-slate-400">{idx + 1}</td>
                                      <td className="py-3 px-3 font-semibold text-slate-200">
                                        <div className="flex items-center gap-2.5">
                                          <div className="w-8 h-8 rounded-lg bg-slate-950 border border-slate-700 flex items-center justify-center overflow-hidden shrink-0 shadow">
                                            {t.logo_url ? (
                                              <img src={t.logo_url} alt="" className="w-full h-full object-cover" />
                                            ) : (
                                              <span className="text-[11px] font-bold text-slate-400">{t.team_name.charAt(0)}</span>
                                            )}
                                          </div>
                                          <span className="truncate max-w-[150px]">{t.team_name}</span>
                                        </div>
                                      </td>
                                      <td className="py-3 px-2 text-center font-bold text-slate-400">{t.wwcd || 0}</td>
                                      <td className="py-3 px-2 text-right font-extrabold text-slate-200">{t.total_points || 0}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>

                        {filteredHistoryD2.length > 10 && (
                          <div className="bg-slate-900/30 backdrop-blur-sm border border-slate-800 rounded-xl p-4 space-y-2">
                            <div className="text-xs font-extrabold text-slate-300 uppercase tracking-wide border-b border-slate-800 pb-2">Top 11 - 20</div>
                            <div className="overflow-x-auto">
                              <table className="w-full text-left text-xs">
                                <thead>
                                  <tr className="text-slate-400 border-b border-slate-800/80">
                                    <th className="py-2.5 px-2 w-10">#</th>
                                    <th className="py-2.5 px-3">ทีม</th>
                                    <th className="py-2.5 px-2 text-center w-12">ไก่</th>
                                    <th className="py-2.5 px-2 text-right w-16">แต้ม</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {filteredHistoryD2.slice(10, 20).map((t: any, idx: number) => {
                                    const key = (t.team_name || '').trim().toLowerCase();
                                    const hofMatch = hallOfFameData.find((h) => (h.team_name || '').trim().toLowerCase() === key);
                                    const teamDataToPass = hofMatch || {
                                      team_name: t.team_name,
                                      logo_url: t.logo_url || '',
                                      totalWWCD: t.wwcd || 0,
                                      totalPlacePoints: t.place_points || 0,
                                      totalKillPoints: t.kill_points || 0,
                                      totalPointsAllTime: t.total_points || 0,
                                    };
                                    return (
                                      <tr 
                                        key={idx} 
                                        onClick={() => handleOpenHistoryTeamModal(teamDataToPass, 'Division 2')}
                                        className="border-b border-slate-800/40 cursor-pointer hover:bg-slate-800/30"
                                      >
                                        <td className="py-3 px-2 font-bold text-slate-400">{idx + 11}</td>
                                        <td className="py-3 px-3 font-semibold text-slate-200">
                                          <div className="flex items-center gap-2.5">
                                            <div className="w-8 h-8 rounded-lg bg-slate-950 border border-slate-700 flex items-center justify-center overflow-hidden shrink-0 shadow">
                                              {t.logo_url ? (
                                                <img src={t.logo_url} alt="" className="w-full h-full object-cover" />
                                              ) : (
                                                <span className="text-[11px] font-bold text-slate-400">{t.team_name.charAt(0)}</span>
                                              )}
                                            </div>
                                            <span className="truncate max-w-[150px]">{t.team_name}</span>
                                          </div>
                                        </td>
                                        <td className="py-3 px-2 text-center font-bold text-slate-400">{t.wwcd || 0}</td>
                                        <td className="py-3 px-2 text-right font-extrabold text-slate-200">{t.total_points || 0}</td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="bg-slate-900/30 backdrop-blur-sm border border-slate-800 rounded-xl p-12 text-center text-slate-500 text-xs">
                        ไม่มีข้อมูลทีมที่ลงแข่งขันใน Division 2 ของซีซั่นนี้
                      </div>
                    )
                  )}
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

        {/* Modal สถิติทีม */}
        {isHistoryTeamModalOpen && selectedHistoryTeam && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex justify-center items-center p-4 z-50">
            <div className="relative overflow-hidden bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 md:p-8 space-y-6 shadow-2xl">
              {selectedHistoryTeam.logo_url && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0 opacity-[0.6] scale-150">
                  <img src={selectedHistoryTeam.logo_url} alt="" className="w-full h-full object-contain blur-[1px]" />
                </div>
              )}

              <div className="relative z-10 flex justify-between items-center border-b border-slate-800 pb-4">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-slate-950 border border-sky-500/40 flex items-center justify-center overflow-hidden shrink-0 shadow-md">
                    {selectedHistoryTeam.logo_url ? (
                      <img src={selectedHistoryTeam.logo_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-2xl font-bold text-sky-400">{selectedHistoryTeam.team_name.charAt(0)}</span>
                    )}
                  </div>
                  <div>
                    <h3 className="text-lg font-extrabold text-sky-400">{selectedHistoryTeam.team_name}</h3>
                    <p className="text-xs text-slate-400">ประวัติผลงานรวมทุกซีซั่นอย่างละเอียด</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsHistoryTeamModalOpen(false)}
                  className="text-slate-400 hover:text-slate-100 font-bold text-base bg-slate-950 w-9 h-9 rounded-full border border-slate-800 flex items-center justify-center shadow"
                >
                  ✕
                </button>
              </div>

              <div className="relative z-10 grid grid-cols-2 md:grid-cols-4 gap-3 bg-slate-950/90 border border-slate-800 rounded-2xl p-4 text-center">
                <div>
                  <div className="text-slate-400 text-xs">ไก่รวม (WWCD)</div>
                  <div className="font-extrabold text-sky-400 text-base mt-0.5">{selectedHistoryTeam.totalWWCD || selectedHistoryTeam.wwcd || 0}</div>
                </div>
                <div>
                  <div className="text-slate-400 text-xs">แต้มรวมทั้งหมด</div>
                  <div className="font-extrabold text-sky-400 text-base mt-0.5">{selectedHistoryTeam.totalPointsAllTime || selectedHistoryTeam.total_points || 0}</div>
                </div>
                <div>
                  <div className="text-slate-400 text-xs">แต้มอันดับสะสม</div>
                  <div className="font-bold text-slate-300 text-sm mt-0.5">{selectedHistoryTeam.totalPlacePoints || selectedHistoryTeam.place_points || 0}</div>
                </div>
                <div>
                  <div className="text-slate-400 text-xs">แต้มคิลสะสม</div>
                  <div className="font-bold text-slate-300 text-sm mt-0.5">{selectedHistoryTeam.totalKillPoints || selectedHistoryTeam.kill_points || 0}</div>
                </div>
              </div>

              <div className="relative z-10 space-y-3">
                <div className="text-xs font-bold text-slate-300 uppercase tracking-wide">ผลงานแยกตามซีซั่น:</div>
                <div className="space-y-2.5 max-h-[320px] overflow-y-auto pr-1">
                  {historyTeamSeasonRecords.length > 0 ? (
                    historyTeamSeasonRecords.map((rec: any, i: number) => (
                      <div key={i} className="bg-slate-950/90 border border-slate-800/90 rounded-xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 text-xs shadow-md">
                        <div>
                          <div className="font-extrabold text-sky-400 text-sm">{rec.season_name}</div>
                          <div className="text-slate-400 mt-0.5">ดิวิชัน: <span className="text-slate-200 font-semibold">{rec.division}</span> | อันดับ: <span className="text-slate-200 font-semibold">{rec.rank}</span></div>
                        </div>
                        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-800">
                          {rec.wwcd > 0 && <span className="bg-sky-500/10 border border-sky-500/30 text-sky-400 px-2 py-1 rounded font-bold">{rec.wwcd} ไก่</span>}
                          <div className="text-right space-x-2">
                            <span className="text-slate-400">อันดับ {rec.place_points}</span>
                            <span className="text-slate-300">คิล {rec.kill_points}</span>
                            <span className="font-extrabold text-sky-400 text-sm">รวม {rec.total_points} แต้ม</span>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-center text-slate-500 py-8 text-xs">ยังไม่มีประวัติผลงานในซีซั่นอื่น ๆ</p>
                  )}
                </div>
              </div>

              <button
                onClick={() => setIsHistoryTeamModalOpen(false)}
                className="relative z-10 w-full bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold py-3 rounded-xl text-xs transition shadow"
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