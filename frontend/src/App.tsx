import { useEffect, useState } from 'react';
import { useStore } from './store/useStore';
import { useAuthStore } from './store/useAuthStore';
import { api } from './lib/api';
import { cn } from "@/lib/utils";
import {
  Search,
  Database,
  Activity,
  ShieldCheck,
  Facebook,
  Trash2,
  XCircle,
  CheckSquare,
  Square,
  Download,
  Clock,
  Infinity,
  TrendingUp,
  MapPin,
  LogOut,
  AlertCircle
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tooltip } from "@/components/ui/tooltip";
import { COUNTRIES, type Country } from './constants/countries';

function LoginScreen() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const login = useAuthStore((s) => s.login);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedUsername = username.trim();
    if (!trimmedUsername) {
      setError('Enter a username');
      return;
    }
    if (!password) {
      setError('Enter a password');
      return;
    }
    if (mode === 'register' && password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      const endpoint = mode === 'register' ? '/api/auth/register' : '/api/auth/login';
      const res = await api.post(endpoint, { username: trimmedUsername, password });
      login(res.data.token, res.data.userId);
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'response' in err
        && (err as { response?: { data?: { error?: string } } }).response?.data?.error
        ? (err as { response: { data: { error: string } } }).response.data.error
        : mode === 'register' ? 'Registration failed' : 'Login failed';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FDFDFD] flex items-center justify-center p-4">
      <Card className="w-full max-w-md border border-gray-100 shadow-sm">
        <CardHeader>
          <CardTitle className="text-xl">
            {mode === 'login' ? 'Sign in' : 'Create account'}
          </CardTitle>
          <CardDescription>
            {mode === 'login'
              ? 'Enter your credentials to access your data.'
              : 'Choose a username and password to get started.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 text-red-700 text-sm border border-red-100">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {error}
              </div>
            )}
            <Input
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="h-11"
              autoComplete="username"
              disabled={submitting}
            />
            <Input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-11"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              disabled={submitting}
            />
            <Button type="submit" className="w-full h-11 bg-blue-600 hover:bg-blue-700" disabled={submitting}>
              {submitting
                ? (mode === 'login' ? 'Signing in...' : 'Creating account...')
                : (mode === 'login' ? 'Sign in' : 'Create account')}
            </Button>
            <div className="text-center text-sm text-gray-500">
              {mode === 'login' ? (
                <>
                  {"Don't have an account? "}
                  <button
                    type="button"
                    onClick={() => { setMode('register'); setError(''); }}
                    className="text-blue-600 hover:underline font-medium"
                  >
                    Sign up
                  </button>
                </>
              ) : (
                <>
                  {"Already have an account? "}
                  <button
                    type="button"
                    onClick={() => { setMode('login'); setError(''); }}
                    className="text-blue-600 hover:underline font-medium"
                  >
                    Sign in
                  </button>
                </>
              )}
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

const App = () => {
  const token = useAuthStore((s) => s.token);
  const userId = useAuthStore((s) => s.userId);
  const logout = useAuthStore((s) => s.logout);
  const { ads, missions, schedulers, loading, adsError, missionsError, isScraping, activeMissions, currentKeyword, scrapeStats, totalAds, currentPage, totalPages, keywords, fetchAds, fetchKeywords, fetchMissions, fetchSchedulers, addKeyword, triggerScrape, stopScrape, fetchStatus, deleteAd, deleteAds, deleteMission, deleteMissions, fetchAdsByKeyword, createScheduler, updateScheduler, deleteScheduler, setPage, fetchAllAds, reset } = useStore();
  const [newKeyword, setNewKeyword] = useState('');
  const [activeSection, setActiveSection] = useState<'database' | 'keywords' | 'autoscraper' | 'google-ads'>('keywords');
  const [selectedAdIds, setSelectedAdIds] = useState<string[]>([]);
  const [selectedMissionIds, setSelectedMissionIds] = useState<string[]>([]);
  const [maxAdsPerRequest, setMaxAdsPerRequest] = useState(1000);
  const [dailyLimit, setDailyLimit] = useState(5000);

  // Google Ads states
  const [googleKeyword, setGoogleKeyword] = useState('');
  const [googleSuggestions, setGoogleSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isGoogleScraping, setIsGoogleScraping] = useState(false);
  const [currentGoogleKeyword, setCurrentGoogleKeyword] = useState('');
  const [googleMaxAds, setGoogleMaxAds] = useState(1000);
  const [googleDailyLimit, setGoogleDailyLimit] = useState(5000);

  // Scheduler form states
  const [schedulerKeyword, setSchedulerKeyword] = useState('');
  const [schedulerCron, setSchedulerCron] = useState('0 */6 * * *');
  const [schedulerMaxAds, setSchedulerMaxAds] = useState(1000);
  const [schedulerDailyLimit, setSchedulerDailyLimit] = useState(5000);
  const [infiniteLoopMode, setInfiniteLoopMode] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [exportKeywordFilter, setExportKeywordFilter] = useState('all');

  // Filter states
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [filterLanguage, setFilterLanguage] = useState('all');
  const [filterAdvertiser, setFilterAdvertiser] = useState('all');
  const [filterPlatforms, setFilterPlatforms] = useState<string[]>([]);
  const [filterMediaType, setFilterMediaType] = useState('all');
  const [filterActiveStatus, setFilterActiveStatus] = useState('all');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [filterCountry, setFilterCountry] = useState('IN');
  const [countrySearch, setCountrySearch] = useState('');
  const [showFilterSuccess, setShowFilterSuccess] = useState(false);

  // Load saved filters from localStorage on mount
  useEffect(() => {
    const savedFilters = localStorage.getItem('scrapingFilters');
    if (savedFilters) {
      try {
        const filters = JSON.parse(savedFilters);
        setFilterLanguage(filters.language || 'all');
        setFilterAdvertiser(filters.advertiser || 'all');
        setFilterPlatforms(filters.platforms || []);
        setFilterMediaType(filters.mediaType || 'all');
        setFilterActiveStatus(filters.activeStatus || 'all');
        setFilterStartDate(filters.startDate || '');
        setFilterEndDate(filters.endDate || '');
        setFilterCountry(filters.country || 'IN');
      } catch (error) {
        console.error('Failed to load saved filters:', error);
      }
    }
  }, []);

  useEffect(() => {
    if (!token) return;
    fetchAds(1);
    fetchKeywords();
    fetchMissions();
    fetchSchedulers();
    fetchStatus();
    fetchGoogleStatus();
    const interval = setInterval(() => {
      fetchAds(currentPage, true);
      fetchStatus();
      fetchMissions();
      fetchGoogleStatus();
    }, 5000);
    const timeInterval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    const schedulerInterval = setInterval(() => {
      fetchSchedulers();
    }, 30000);
    return () => {
      clearInterval(interval);
      clearInterval(timeInterval);
      clearInterval(schedulerInterval);
    };
  }, [token, fetchAds, fetchMissions, fetchStatus]);

  // Google Ads functions
  const fetchGoogleStatus = async () => {
    try {
      const res = await api.get('/api/google-ads/status');
      const data = res.data;
      setIsGoogleScraping(data.isScraping);
      setCurrentGoogleKeyword(data.currentKeyword ?? '');
    } catch (error) {
      console.error('Failed to fetch Google Ads status:', error);
    }
  };

  const fetchGoogleSuggestions = async (keyword: string) => {
    if (keyword.length < 2) {
      setGoogleSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    try {
      const res = await api.get(`/api/google-ads/suggestions/${encodeURIComponent(keyword)}`);
      setGoogleSuggestions(res.data.suggestions || []);
      setShowSuggestions(true);
    } catch (error) {
      console.error('Failed to fetch Google Ads suggestions:', error);
      setGoogleSuggestions([]);
    } finally {
    }
  };

  const handleGoogleKeywordChange = (value: string) => {
    setGoogleKeyword(value);
    fetchGoogleSuggestions(value);
  };

  const handleGoogleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (googleKeyword.trim()) {
      try {
        await api.post('/api/google-ads/scrape', {
          keyword: googleKeyword.trim(),
          maxAdsPerRequest: googleMaxAds,
          dailyLimit: googleDailyLimit,
        });
        setIsGoogleScraping(true);
        setCurrentGoogleKeyword(googleKeyword.trim());
        setGoogleKeyword('');
        setShowSuggestions(false);
        setTimeout(() => {
          fetchAds();
          fetchMissions();
        }, 5000);
      } catch (error: unknown) {
        console.error('Error starting Google Ads scrape:', error);
        const msg = error && typeof error === 'object' && 'response' in error && (error as { response?: { data?: { error?: string } } }).response?.data?.error
          ? (error as { response: { data: { error: string } } }).response.data.error
          : 'Failed to start Google Ads scrape';
        alert(msg);
      }
    }
  };

  const handleStopGoogleScrape = async () => {
    try {
      await api.post('/api/google-ads/stop', {});
      setIsGoogleScraping(false);
      setCurrentGoogleKeyword('');
    } catch (error: unknown) {
      console.error('Error stopping Google Ads scrape:', error);
      const msg = error && typeof error === 'object' && 'response' in error && (error as { response?: { data?: { error?: string } } }).response?.data?.error
        ? (error as { response: { data: { error: string } } }).response.data.error
        : 'Failed to stop Google Ads scrape';
      alert(msg);
    }
  };

  const selectSuggestion = (suggestion: any) => {
    setGoogleKeyword(suggestion.advertiserName);
    setGoogleSuggestions([]);
    setShowSuggestions(false);
  };

  // Helper function to count active filters
  const getActiveFilterCount = () => {
    let count = 0;
    if (filterLanguage !== 'all') count++;
    if (filterAdvertiser !== 'all') count++;
    if (filterPlatforms.length > 0) count++;
    if (filterMediaType !== 'all') count++;
    if (filterActiveStatus !== 'all') count++;
    if (filterStartDate) count++;
    if (filterEndDate) count++;
    if (filterCountry !== 'ALL') count++;
    return count;
  };

  // Save filters to localStorage
  const saveFiltersToStorage = () => {
    const filters = {
      language: filterLanguage,
      advertiser: filterAdvertiser,
      platforms: filterPlatforms,
      mediaType: filterMediaType,
      activeStatus: filterActiveStatus,
      startDate: filterStartDate,
      endDate: filterEndDate,
      country: filterCountry
    };
    localStorage.setItem('scrapingFilters', JSON.stringify(filters));
  };

  // Handle apply filters with success notification
  const handleApplyFilters = () => {
    saveFiltersToStorage();
    setShowFilterModal(false);
    setShowFilterSuccess(true);
    setTimeout(() => setShowFilterSuccess(false), 3000);
  };

  // Handle reset filters
  const handleResetFilters = () => {
    setFilterLanguage('all');
    setFilterAdvertiser('all');
    setFilterPlatforms([]);
    setFilterMediaType('all');
    setFilterActiveStatus('all');
    setFilterStartDate('');
    setFilterEndDate('');
    setFilterCountry('IN');
    localStorage.removeItem('scrapingFilters');
  };

  const handleAddKeyword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newKeyword.trim()) {
      const kw = newKeyword.trim();
      setNewKeyword('');
      addKeyword(kw);

      // Build filter object
      const filters = {
        language: filterLanguage !== 'all' ? filterLanguage : undefined,
        advertiser: filterAdvertiser !== 'all' ? filterAdvertiser : undefined,
        platforms: filterPlatforms.length > 0 ? filterPlatforms : undefined,
        mediaType: filterMediaType !== 'all' ? filterMediaType : undefined,
        activeStatus: filterActiveStatus !== 'all' ? filterActiveStatus : undefined,
        startDate: filterStartDate || undefined,
        endDate: filterEndDate || undefined,
        country: filterCountry,
      };

      await triggerScrape(kw, maxAdsPerRequest, dailyLimit, filters);
      // Immediately fetch ads after trigger is sent
      setTimeout(fetchAds, 5000);
      setTimeout(fetchAds, 15000);
    }
  };

  const toggleSelectAll = () => {
    if (selectedAdIds.length === ads.length) {
      setSelectedAdIds([]);
    } else {
      setSelectedAdIds(ads.map(ad => ad._id));
    }
  };

  const toggleSelectAd = (id: string) => {
    setSelectedAdIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAllMissions = () => {
    if (selectedMissionIds.length === missions.length) {
      setSelectedMissionIds([]);
    } else {
      setSelectedMissionIds(missions.map(mission => mission._id));
    }
  };

  const toggleSelectMission = (id: string) => {
    setSelectedMissionIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleDeleteMission = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this mission?')) {
      await deleteMission(id);
    }
  };

  const handleDeleteSelectedMissions = async () => {
    if (selectedMissionIds.length === 0) return;
    if (window.confirm(`Are you sure you want to delete ${selectedMissionIds.length} mission(s)?`)) {
      await deleteMissions(selectedMissionIds);
      setSelectedMissionIds([]);
    }
  };

  const handleExportToExcel = async () => {
    console.log('🔵 Export to Excel clicked! Target: All Ads');

    try {
      const XLSX = await import('xlsx');
      console.log('✅ XLSX library loaded');

      const allAds = await fetchAllAds();
      console.log('📦 Total ads for export:', allAds.length);

      // Filter data based on selected keyword
      const dataToExport = exportKeywordFilter === 'all'
        ? allAds
        : allAds.filter((ad: any) => ad.keyword === exportKeywordFilter);

      console.log('📦 Filtered data to export count:', dataToExport.length);

      if (dataToExport.length === 0) {
        alert('No data found for the selected filter.');
        return;
      }

      // Helper to truncate text for Excel cell limit (32,767 chars)
      const truncateForExcel = (text: any) => {
        if (text === undefined || text === null) return 'N/A';
        const str = String(text);
        // Excel limit is 32,767. We use 32,680 + suffix to be safe.
        return str.length > 32700 ? str.substring(0, 32680) + '... [Truncated]' : str;
      };

      // Prepare data for export
      const exportData = dataToExport.map((ad, index) => ({
        'S.No': index + 1,
        'Advertiser Name': truncateForExcel(ad.advertiser_name),
        'Ad Description': truncateForExcel(ad.ad_description),
        'Keyword': ad.keyword || 'N/A',
        'Phone': ad.phone || 'N/A',
        'Address': truncateForExcel(ad.address),
        'Scrape Date': ad.scrape_date ? new Date(ad.scrape_date).toLocaleString('en-IN') : 'N/A'
      }));

      // Create workbook
      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Facebook Ads');

      // Set column widths
      const colWidths = [
        { wch: 8 },  // S.No
        { wch: 25 }, // Advertiser Name
        { wch: 50 }, // Ad Description
        { wch: 15 }, // Keyword
        { wch: 15 }, // Phone
        { wch: 30 }, // Address
        { wch: 25 }  // Scrape Date
      ];
      ws['!cols'] = colWidths;

      // NOTE: SheetJS Community Edition does not support styles (.s property)
      // Removing styling code to prevent potential errors

      // Generate filename with timestamp
      const now = new Date();
      const timestamp = `${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}_${now.getHours().toString().padStart(2, '0')}${now.getMinutes().toString().padStart(2, '0')}`;
      const filename = `Facebook_Ads_Export_${timestamp}.xlsx`;

      console.log('💾 Writing file:', filename);
      XLSX.writeFile(wb, filename);
      console.log('✅ Export complete');
    } catch (error) {
      console.error('Export error:', error);
      alert('An error occurred during export.');
    }
  };

  const handleDownloadMissionAds = async (keyword: string) => {
    try {
      console.log('🔵 Downloading mission ads for:', keyword);
      const missionAds = await fetchAdsByKeyword(keyword);

      if (missionAds.length === 0) {
        alert('No ads found for this keyword');
        return;
      }

      import('xlsx').then((XLSX) => {
        // Helper to truncate text for Excel cell limit (32,767 chars)
        const truncateForExcel = (text: any) => {
          if (text === undefined || text === null) return 'N/A';
          const str = String(text);
          // Excel limit is 32,767. We use 32,680 + suffix to be safe.
          return str.length > 32700 ? str.substring(0, 32680) + '... [Truncated]' : str;
        };

        // Prepare data for export
        const exportData = missionAds.map((ad, index) => ({
          'S.No': index + 1,
          'Advertiser Name': truncateForExcel(ad.advertiser_name),
          'Ad Description': truncateForExcel(ad.ad_description),
          'Keyword': ad.keyword || 'N/A',
          'Phone': ad.phone || 'N/A',
          'Address': truncateForExcel(ad.address),
          'Scrape Date': ad.scrape_date ? new Date(ad.scrape_date).toLocaleString('en-IN') : 'N/A'
        }));

        // Create workbook
        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Facebook Ads');

        // Set column widths
        const colWidths = [
          { wch: 8 },  // S.No
          { wch: 25 }, // Advertiser Name
          { wch: 50 }, // Ad Description
          { wch: 15 }, // Keyword
          { wch: 15 }, // Phone
          { wch: 30 }, // Address
          { wch: 25 }  // Scrape Date
        ];
        ws['!cols'] = colWidths;

        // Note: Styling removed as it's not supported in Community Edition

        // Generate filename
        const now = new Date();
        const timestamp = `${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}`;
        const safeKeyword = keyword.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        const filename = `Facebook_Ads_${safeKeyword}_${timestamp}.xlsx`;

        XLSX.writeFile(wb, filename);
        console.log('✅ Mission export complete');
      });
    } catch (error) {
      console.error('Mission export error:', error);
      alert('Failed to export mission ads.');
    }
  };

  const handleCreateScheduler = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!schedulerKeyword.trim()) {
      alert('Please enter a keyword');
      return;
    }

    try {
      await createScheduler(
        schedulerKeyword.trim(),
        schedulerCron,
        schedulerMaxAds,
        schedulerDailyLimit
      );

      // Reset form
      setSchedulerKeyword('');
      setSchedulerCron('0 */6 * * *');
      setSchedulerMaxAds(1000);
      setSchedulerDailyLimit(5000);
      setInfiniteLoopMode(false);

      // Immediate refresh to get updated nextRun time
      await fetchSchedulers();

      alert('Scheduler created successfully!');
    } catch (error: any) {
      alert('Failed to create scheduler: ' + (error.response?.data?.error || error.message));
    }
  };

  // Helper function to calculate countdown
  const getCountdown = (nextRun: string | Date) => {
    if (!nextRun) return { text: 'Not scheduled', color: 'text-gray-400' };

    const next = new Date(nextRun);
    const now = currentTime;
    const diff = next.getTime() - now.getTime();

    // If nextRun is more than 1 hour in the past, it's likely stale data
    const oneHourAgo = now.getTime() - (60 * 60 * 1000);
    if (next.getTime() < oneHourAgo) {
      return { text: 'Schedule needs refresh...', color: 'text-red-500' };
    }

    if (diff <= 0) {
      return { text: 'Running now...', color: 'text-green-600 font-medium' };
    }

    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return { text: `In ${days}d ${hours % 24}h`, color: 'text-blue-600' };
    } else if (hours > 0) {
      return { text: `In ${hours}h ${minutes % 60}m`, color: 'text-blue-600' };
    } else if (minutes > 0) {
      return { text: `In ${minutes}m ${seconds % 60}s`, color: 'text-orange-600' };
    } else {
      return { text: `In ${seconds}s`, color: 'text-red-600 font-medium' };
    }
  };

  const handleBulkDelete = async () => {
    if (confirm(`Are you sure you want to delete ${selectedAdIds.length} ads?`)) {
      await deleteAds(selectedAdIds);
      setSelectedAdIds([]);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this ad?')) {
      await deleteAd(id);
    }
  };

  if (!token) {
    return <LoginScreen />;
  }

  return (
    <div className="min-h-screen bg-[#FDFDFD] text-[#1A1A1A] font-sans">
      <aside className="fixed left-0 top-0 h-full w-64 border-r border-gray-100 bg-white p-6 hidden lg:block">
        <div className="flex items-center gap-3 mb-10">
          <h1 className="text-xl font-bold tracking-tight">AD INTELLIGENCE</h1>
        </div>
        <div className="mb-4 flex items-center justify-between gap-2">
          <span className="text-xs text-gray-500 truncate" title={userId ?? undefined}>{userId ?? '—'}</span>
          <Button variant="ghost" size="sm" className="shrink-0 h-8 w-8 p-0 text-gray-500 hover:text-red-600" onClick={() => { reset(); logout(); }} title="Sign out">
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
        <nav className="space-y-2">
          <Button
            variant={(activeSection === 'keywords' ? 'secondary' : 'ghost') as any}
            className={`w-full justify-start gap-3 ${activeSection === 'keywords' ? 'bg-gray-50 text-blue-600' : 'text-gray-400'} font-medium transition-all`}
            onClick={() => setActiveSection('keywords')}
          >
            <Search className="w-4 h-4" />
            Scrape Ads
          </Button>
          <Button
            variant={(activeSection === 'database' ? 'secondary' : 'ghost') as any}
            className={`w-full justify-start gap-3 ${activeSection === 'database' ? 'bg-gray-50 text-blue-600' : 'text-gray-400'} font-medium transition-all`}
            onClick={() => setActiveSection('database')}
          >
            <Database className="w-4 h-4" />
            Cards-Data
          </Button>
          <Button
            variant={(activeSection === 'autoscraper' ? 'secondary' : 'ghost') as any}
            className={`w-full justify-start gap-3 ${activeSection === 'autoscraper' ? 'bg-gray-50 text-blue-600' : 'text-gray-400'} font-medium transition-all`}
            onClick={() => setActiveSection('autoscraper')}
          >
            <Clock className="w-4 h-4" />
            Auto Scrape
          </Button>
          <Button
            variant={(activeSection === 'google-ads' ? 'secondary' : 'ghost') as any}
            className={`w-full justify-start gap-3 ${activeSection === 'google-ads' ? 'bg-gray-50 text-blue-600' : 'text-gray-400'} font-medium transition-all`}
            onClick={() => setActiveSection('google-ads')}
          >
            <TrendingUp className="w-4 h-4" />
            Google Ads
          </Button>

          <div className="pt-4 mt-4 border-t border-gray-50">
            <Button variant={"ghost" as any} className="w-full justify-start gap-3 text-gray-400 hover:text-gray-900 cursor-not-allowed opacity-50">
              <Activity className="w-4 h-4" />
              Activity
            </Button>
            <Button variant={"ghost" as any} className="w-full justify-start gap-3 text-gray-400 hover:text-gray-900 cursor-not-allowed opacity-50">
              <ShieldCheck className="w-4 h-4" />
              Stealth Settings
            </Button>
          </div>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="lg:ml-64 p-8 max-w-7xl mx-auto">
        {/* Header Section */}
        {activeSection === 'keywords' && (
          <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-10">
            <div>
              <h2 className="text-3xl font-bold tracking-tight mb-1">
                Scrape Ads
              </h2>
              <p className="text-gray-400">
                Scrape Ads: Instant search and automated ad extraction.
              </p>
            </div>
            <div className="flex items-center gap-3">
              {isScraping && (
                <Badge variant={"outline" as any} className="bg-orange-50 text-orange-600 border-orange-100 animate-pulse px-3 py-1 gap-2 flex items-center">
                  <Activity className="w-3 h-3" /> Scraper Active
                </Badge>
              )}
            </div>
          </header>
        )}

        {activeSection === 'keywords' && (
          <section className="mb-10 animate-in fade-in slide-in-from-bottom-2 duration-300">
            {(adsError || missionsError) && (
              <div className="mb-6 flex items-center gap-2 p-4 rounded-xl bg-red-50 border border-red-100 text-red-800 text-sm">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <div>
                  {adsError && <p>{adsError}</p>}
                  {missionsError && <p>{missionsError}</p>}
                </div>
              </div>
            )}
            <Card className="border-none shadow-sm bg-white ring-1 ring-gray-100 mb-6">
              <CardHeader>
                <CardTitle className="text-lg">Instant Search & Scrape</CardTitle>
                <CardDescription>Enter a topic to trigger the bot. It will automatically scrape and display new ads.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2 items-center">
                  <form onSubmit={handleAddKeyword} className="flex gap-2 flex-1">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <Input
                        placeholder="Search and scrape (e.g. real estate)..."
                        className="pl-10 h-11 border-gray-100 focus:ring-blue-500"
                        value={newKeyword}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewKeyword(e.target.value)}
                      />
                    </div>
                    <div className="flex gap-2 items-center">
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-gray-600">Max Ads:</label>
                        <Input
                          type="number"
                          min="20"
                          value={maxAdsPerRequest}
                          onChange={(e) => setMaxAdsPerRequest(parseInt(e.target.value) || 1000)}
                          className="w-24 h-11 text-sm"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-gray-600">Daily Limit:</label>
                        <Input
                          type="number"
                          min="1000"
                          value={dailyLimit}
                          onChange={(e) => setDailyLimit(parseInt(e.target.value) || 5000)}
                          className="w-28 h-11 text-sm"
                        />
                      </div>
                    </div>
                    <Button
                      type="submit"
                      className={`h-11 bg-blue-600 hover:bg-blue-700 px-8 gap-2 transition-all duration-300 shadow-sm cursor-pointer`}
                    >
                      <><Search className="w-4 h-4" /> Start Search</>
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className={`h-11 px-6 gap-2 relative ${getActiveFilterCount() > 0 ? 'border-blue-500 bg-blue-50 text-blue-700 hover:bg-blue-100' : 'border-gray-200 hover:bg-gray-50'}`}
                      onClick={() => setShowFilterModal(true)}
                    >
                      <ShieldCheck className="w-4 h-4" />
                      Filters
                      {getActiveFilterCount() > 0 && (
                        <span className="absolute -top-1 -right-1 bg-blue-600 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                          {getActiveFilterCount()}
                        </span>
                      )}
                    </Button>
                  </form>
                  {isScraping && (
                    <Button
                      type="button"
                      variant="destructive"
                      className="h-11 px-6 gap-2 bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 cursor-pointer"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        console.log('Stop button clicked!');
                        stopScrape();
                      }}
                    >
                      <XCircle className="w-4 h-4" /> Stop
                    </Button>
                  )}
                </div>
                {isScraping && activeMissions.length > 0 && (
                  <div className="mt-4 space-y-2">
                    {activeMissions.map((mission) => (
                      <div key={mission.missionId} className="p-4 bg-orange-50/50 rounded-xl border border-orange-100 flex items-center justify-between animate-in fade-in slide-in-from-top-1 duration-500">
                        <div className="flex items-center gap-3 flex-1">
                          <div className="w-2 h-2 bg-orange-500 rounded-full animate-ping shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-orange-900">
                              Active Scrape: <span className="text-blue-600">"{mission.keyword}"</span>
                            </p>
                            <p className="text-xs text-orange-600">Extracting live ads from Facebook Library</p>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50 shrink-0"
                            onClick={() => stopScrape(mission.missionId)}
                            title={`Stop "${mission.keyword}"`}
                          >
                            <XCircle className="w-4 h-4" />
                          </Button>
                        </div>
                        <div className="text-right ml-4 shrink-0">
                          <p className="text-sm font-bold text-orange-900">{mission.stats.adsFound} Ads Found</p>
                          <p className="text-xs text-orange-600">+{mission.stats.newAds} New</p>
                        </div>
                      </div>
                    ))}
                    {activeMissions.length > 1 && (
                      <div className="text-center pt-2">
                        <p className="text-xs text-orange-600 font-medium">
                          {activeMissions.length} active scrapes running simultaneously
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Success Notification */}
            {showFilterSuccess && (
              <div className="mb-6 p-3 bg-green-50 rounded-lg border border-green-200 flex items-center gap-2 animate-in fade-in slide-in-from-top-1 duration-300">
                <div className="w-2 h-2 bg-green-500 rounded-full" />
                <p className="text-sm font-medium text-green-800">✅ Filters saved and will be applied to next scrape</p>
              </div>
            )}

            {/* Active Filters Display */}
            {getActiveFilterCount() > 0 && (
              <div className="mb-6 p-4 bg-blue-50/50 rounded-xl border border-blue-100">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-blue-900 uppercase tracking-wider">Active Filters ({getActiveFilterCount()})</p>
                  <button
                    onClick={handleResetFilters}
                    className="text-xs text-blue-600 hover:text-blue-800 font-medium underline"
                  >
                    Clear All
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {filterLanguage !== 'all' && (
                    <span className="inline-flex items-center gap-1 px-3 py-1 bg-white border border-blue-200 rounded-full text-xs font-medium text-blue-700">
                      Language: {filterLanguage}
                      <button onClick={() => setFilterLanguage('all')} className="hover:bg-blue-100 rounded-full p-0.5">
                        <XCircle className="w-3 h-3" />
                      </button>
                    </span>
                  )}
                  {filterAdvertiser !== 'all' && (
                    <span className="inline-flex items-center gap-1 px-3 py-1 bg-white border border-blue-200 rounded-full text-xs font-medium text-blue-700">
                      Advertiser: {filterAdvertiser}
                      <button onClick={() => setFilterAdvertiser('all')} className="hover:bg-blue-100 rounded-full p-0.5">
                        <XCircle className="w-3 h-3" />
                      </button>
                    </span>
                  )}
                  {filterPlatforms.length > 0 && (
                    <span className="inline-flex items-center gap-1 px-3 py-1 bg-white border border-blue-200 rounded-full text-xs font-medium text-blue-700">
                      Platforms: {filterPlatforms.join(', ')}
                      <button onClick={() => setFilterPlatforms([])} className="hover:bg-blue-100 rounded-full p-0.5">
                        <XCircle className="w-3 h-3" />
                      </button>
                    </span>
                  )}
                  {filterMediaType !== 'all' && (
                    <span className="inline-flex items-center gap-1 px-3 py-1 bg-white border border-blue-200 rounded-full text-xs font-medium text-blue-700">
                      Media: {filterMediaType}
                      <button onClick={() => setFilterMediaType('all')} className="hover:bg-blue-100 rounded-full p-0.5">
                        <XCircle className="w-3 h-3" />
                      </button>
                    </span>
                  )}
                  {filterActiveStatus !== 'all' && (
                    <span className="inline-flex items-center gap-1 px-3 py-1 bg-white border border-blue-200 rounded-full text-xs font-medium text-blue-700">
                      Status: {filterActiveStatus}
                      <button onClick={() => setFilterActiveStatus('all')} className="hover:bg-blue-100 rounded-full p-0.5">
                        <XCircle className="w-3 h-3" />
                      </button>
                    </span>
                  )}
                  {filterCountry !== 'ALL' && (
                    <span className="inline-flex items-center gap-1 px-3 py-1 bg-white border border-blue-200 rounded-full text-xs font-medium text-blue-700">
                      Country: {filterCountry}
                      <button onClick={() => setFilterCountry('ALL')} className="hover:bg-blue-100 rounded-full p-0.5">
                        <XCircle className="w-3 h-3" />
                      </button>
                    </span>
                  )}
                  {filterStartDate && (
                    <span className="inline-flex items-center gap-1 px-3 py-1 bg-white border border-blue-200 rounded-full text-xs font-medium text-blue-700">
                      From: {filterStartDate}
                      <button onClick={() => setFilterStartDate('')} className="hover:bg-blue-100 rounded-full p-0.5">
                        <XCircle className="w-3 h-3" />
                      </button>
                    </span>
                  )}
                  {filterEndDate && (
                    <span className="inline-flex items-center gap-1 px-3 py-1 bg-white border border-blue-200 rounded-full text-xs font-medium text-blue-700">
                      To: {filterEndDate}
                      <button onClick={() => setFilterEndDate('')} className="hover:bg-blue-100 rounded-full p-0.5">
                        <XCircle className="w-3 h-3" />
                      </button>
                    </span>
                  )}
                </div>
              </div>
            )}

            {isScraping && (
              <Card className="border-none shadow-sm bg-white ring-1 ring-gray-100 mb-6 animate-in fade-in slide-in-from-bottom-2 duration-500 delay-150">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-sm font-bold text-gray-900 flex items-center gap-2">
                        <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />
                        Live Scrape Feed
                      </CardTitle>
                      <CardDescription className="text-xs">Real-time stream of detected advertisements.</CardDescription>
                    </div>
                    <Badge variant={"outline" as any} className="text-[10px] bg-blue-50 text-blue-600 border-blue-100 px-2 py-0">
                      Syncing...
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {(() => {
                      const activeKeywords = activeMissions.map(m => m.keyword);
                      const recentAds = ads.filter(a => activeKeywords.includes(a.keyword))
                        .sort((a, b) => new Date(b.scrape_date).getTime() - new Date(a.scrape_date).getTime())
                        .slice(0, 5);
                      return recentAds.length > 0 ? (
                        recentAds.map((ad: any) => (
                          <div key={ad._id} className="flex items-start gap-3 p-3 rounded-lg bg-gray-50/50 border border-gray-100 animate-in fade-in zoom-in-95 duration-300">
                            <div className="bg-white p-1.5 rounded-md shadow-sm ring-1 ring-gray-100">
                              <Facebook className="w-3 h-3 text-blue-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <p className="text-[11px] font-bold text-gray-900 truncate">{ad.advertiser_name}</p>
                                <span className="text-[9px] text-blue-600 font-medium px-1.5 py-0.5 bg-blue-50 rounded">
                                  {ad.keyword}
                                </span>
                              </div>
                              <p className="text-[10px] text-gray-500 line-clamp-1">{ad.ad_description}</p>
                            </div>
                            <span className="text-[9px] font-mono text-gray-400 whitespace-nowrap">JUST NOW</span>
                          </div>
                        ))
                      ) : (
                        <div className="py-8 text-center">
                          <Activity className="w-6 h-6 text-gray-200 mx-auto mb-2 animate-bounce" />
                          <p className="text-xs text-gray-400">Waiting for first detections...</p>
                        </div>
                      );
                    })()}
                  </div>
                </CardContent>
              </Card>
            )}

            {!loading && ads.length === 0 && !isScraping && (
              <div className="mt-10 py-12 text-center rounded-xl border border-dashed border-gray-200 bg-gray-50/50">
                <Database className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-600 font-medium">No scraped ads yet</p>
                <p className="text-sm text-gray-500 mt-1">Start a search above to scrape ads. Results appear here and update in real time.</p>
              </div>
            )}

            {/* Scrape History Table */}
            <div className="mt-10 animate-in fade-in duration-500">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold px-1">Scrape Execution History</h3>
                <div className="flex items-center gap-2">
                  {selectedMissionIds.length > 0 && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={handleDeleteSelectedMissions}
                      className="cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4 mr-1" />
                      Delete ({selectedMissionIds.length})
                    </Button>
                  )}
                  <Badge variant="outline" className="bg-gray-50 text-gray-500 border-gray-100 font-normal">
                    Last 50 Runs
                  </Badge>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden ring-1 ring-gray-100">
                <Table>
                  <TableHeader className="bg-gray-50/50">
                    <TableRow className="border-gray-100">
                      <TableHead className="font-semibold text-gray-900 w-8">
                        <button
                          onClick={toggleSelectAllMissions}
                          className="cursor-pointer hover:bg-gray-100 rounded p-1"
                        >
                          {selectedMissionIds.length === missions.length && missions.length > 0 ? (
                            <CheckSquare className="w-4 h-4 text-blue-600" />
                          ) : (
                            <Square className="w-4 h-4 text-gray-400" />
                          )}
                        </button>
                      </TableHead>
                      <TableHead className="font-semibold text-gray-900">Keyword</TableHead>
                      <TableHead className="font-semibold text-gray-900 w-16 text-center">Country</TableHead>
                      <TableHead className="font-semibold text-gray-900">Ads Detected</TableHead>
                      <TableHead className="font-semibold text-gray-900">Status</TableHead>
                      <TableHead className="font-semibold text-gray-900">Duration</TableHead>
                      <TableHead className="font-semibold text-gray-900">Time</TableHead>
                      <TableHead className="font-semibold text-gray-900 w-24">Ads Data</TableHead>
                      <TableHead className="font-semibold text-gray-900 w-16">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {missions.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="h-24 text-center text-gray-400 text-sm">No scrape logs yet.</TableCell>
                      </TableRow>
                    ) : (
                      missions.map((m: any) => (
                        <TableRow key={m._id} className="border-gray-100">
                          <TableCell className="w-8">
                            <button
                              onClick={() => toggleSelectMission(m._id)}
                              className="cursor-pointer hover:bg-gray-100 rounded p-1"
                            >
                              {selectedMissionIds.includes(m._id) ? (
                                <CheckSquare className="w-4 h-4 text-blue-600" />
                              ) : (
                                <Square className="w-4 h-4 text-gray-400" />
                              )}
                            </button>
                          </TableCell>
                          <TableCell className="font-bold text-blue-600">"{m.keyword}"</TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline" className="bg-gray-50 text-gray-500 border-gray-100 text-[10px] font-bold">
                              {m.country || 'IN'}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-medium">
                            <div className="flex flex-col">
                              <span className="text-green-600 font-bold">+{m.newAds || 0} New</span>
                              <span className="text-gray-400 text-[10px]">{m.adsFound} detected</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0 ${m.status === 'completed' ? 'bg-green-50 text-green-700 border-green-100' :
                                m.status === 'running' ? 'bg-blue-50 text-blue-700 border-blue-100 animate-pulse' :
                                  'bg-red-50 text-red-700 border-red-100'
                                }`}
                            >
                              {m.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-gray-400 text-xs">
                            {m.endTime ? `${Math.round((new Date(m.endTime).getTime() - new Date(m.startTime).getTime()) / 1000)}s` : '---'}
                          </TableCell>
                          <TableCell className="text-gray-400 text-xs">
                            {new Date(m.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </TableCell>
                          <TableCell className="w-24">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDownloadMissionAds(m.keyword)}
                              className="cursor-pointer bg-green-50 text-green-700 border-green-200 hover:bg-green-100 text-xs"
                              disabled={m.adsFound === 0}
                            >
                              <Download className="w-3 h-3 mr-1" />
                              Download
                            </Button>
                          </TableCell>
                          <TableCell className="w-16">
                            <div className="flex gap-1 justify-end">
                              {m.status === 'running' && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => stopScrape(m._id)}
                                  className="cursor-pointer hover:bg-orange-50 text-orange-600 hover:text-orange-700 p-1"
                                  title="Stop this mission"
                                >
                                  <XCircle className="w-4 h-4" />
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteMission(m._id)}
                                className="cursor-pointer hover:bg-red-50 text-red-600 hover:text-red-700 p-1"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </section>
        )}

        {/* Auto Scrape Section */}
        {activeSection === 'autoscraper' && (
          <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-10">
            <div>
              <h2 className="text-3xl font-bold tracking-tight mb-1">
                Auto Scrape
              </h2>
              <p className="text-gray-400">
                Automated scheduling: Set up recurring scraping tasks with custom intervals.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-100">
                <Clock className="w-3 h-3 mr-1" />
                Scheduled Tasks
              </Badge>
            </div>
          </header>
        )}

        {activeSection === 'autoscraper' && (
          <section className="mb-10 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <Card className="border-none shadow-sm bg-white ring-1 ring-gray-100 mb-6">
              <CardHeader>
                <CardTitle className="text-lg">Schedule New Auto Scrape</CardTitle>
                <CardDescription>Set up automated scraping with custom intervals and limits.</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCreateScheduler} className="space-y-4">
                  {/* Infinite Loop Toggle */}
                  <div className="flex items-center justify-between p-4 bg-linear-to-r from-purple-50 to-blue-50 rounded-lg border border-purple-100">
                    <div className="flex items-center gap-3">
                      <Button
                        type="button"
                        variant={infiniteLoopMode ? "default" : "outline"}
                        size="sm"
                        onClick={() => setInfiniteLoopMode(!infiniteLoopMode)}
                        className={`cursor-pointer ${infiniteLoopMode
                          ? 'bg-purple-600 text-white hover:bg-purple-700'
                          : 'bg-white text-purple-600 border-purple-200 hover:bg-purple-50'
                          }`}
                      >
                        <Infinity className="w-4 h-4 mr-2" />
                        Infinite Loop
                      </Button>
                      <div className="text-sm text-gray-600">
                        {infiniteLoopMode ? (
                          <span className="text-purple-700 font-medium">Auto-Run mode enabled - continuous execution</span>
                        ) : (
                          <span>Scheduled mode - use custom interval</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Keyword</label>
                      <Input
                        value={schedulerKeyword}
                        onChange={(e) => setSchedulerKeyword(e.target.value)}
                        placeholder="Enter keyword to scrape"
                        className="border-gray-100"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Schedule {infiniteLoopMode && <span className="text-purple-600">(Infinite Loop - choose your interval)</span>}
                      </label>
                      <select
                        value={schedulerCron}
                        onChange={(e) => setSchedulerCron(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-100 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="*/2 * * * *">Every 2 minutes (Fastest)</option>
                        <option value="*/3 * * * *">Every 3 minutes</option>
                        <option value="*/5 * * * *">Every 5 minutes</option>
                        <option value="*/10 * * * *">Every 10 minutes</option>
                        <option value="*/15 * * * *">Every 15 minutes</option>
                        <option value="*/30 * * * *">Every 30 minutes</option>
                        <option value="0 */1 * * *">Every 1 hour</option>
                        <option value="0 */6 * * *">Every 6 hours</option>
                        <option value="0 */12 * * *">Every 12 hours</option>
                        <option value="0 0 * * *">Daily at midnight</option>
                        <option value="0 0 * * 0">Weekly on Sunday</option>
                        <option value="0 0 1 * *">Monthly on 1st</option>
                      </select>
                      {infiniteLoopMode && (
                        <p className="text-xs text-purple-600 mt-1">⚡ Choose your preferred interval for continuous automated scraping</p>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Max Ads per Request</label>
                      <Input
                        type="number"
                        value={schedulerMaxAds}
                        onChange={(e) => setSchedulerMaxAds(parseInt(e.target.value) || 1000)}
                        placeholder="1000"
                        className="border-gray-100"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Daily Limit</label>
                      <Input
                        type="number"
                        value={schedulerDailyLimit}
                        onChange={(e) => setSchedulerDailyLimit(parseInt(e.target.value) || 5000)}
                        placeholder="5000"
                        className="border-gray-100"
                      />
                    </div>
                  </div>
                  <Button
                    type="submit"
                    className={`${infiniteLoopMode
                      ? 'bg-purple-600 text-white hover:bg-purple-700'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                      } cursor-pointer`}
                  >
                    {infiniteLoopMode ? (
                      <>
                        <Infinity className="w-4 h-4 mr-2" />
                        Start Infinite Loop
                      </>
                    ) : (
                      <>
                        <Clock className="w-4 h-4 mr-2" />
                        Create Schedule
                      </>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Scheduled Tasks Table */}
            <div className="mt-10 animate-in fade-in duration-500">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold px-1">Active Schedules</h3>
                <Badge variant="outline" className="bg-gray-50 text-gray-500 border-gray-100 font-normal">
                  {schedulers.filter(s => s && s.isActive).length} Active Tasks
                </Badge>
              </div>

              <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden ring-1 ring-gray-100">
                <Table>
                  <TableHeader className="bg-gray-50/50">
                    <TableRow className="border-gray-100">
                      <TableHead className="font-semibold text-gray-900">Keyword</TableHead>
                      <TableHead className="font-semibold text-gray-900">Schedule</TableHead>
                      <TableHead className="font-semibold text-gray-900">Status</TableHead>
                      <TableHead className="font-semibold text-gray-900">Last Run</TableHead>
                      <TableHead className="font-semibold text-gray-900">Next Run</TableHead>
                      <TableHead className="font-semibold text-gray-900">Success Rate</TableHead>
                      <TableHead className="font-semibold text-gray-900 w-32">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {schedulers.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="h-32 text-center text-gray-400 text-sm">
                          No scheduled tasks yet. Create your first automated scraping schedule above.
                        </TableCell>
                      </TableRow>
                    ) : (
                      schedulers.filter(s => s).map((scheduler: any) => (
                        <TableRow key={scheduler._id} className="border-gray-100">
                          <TableCell className="font-bold text-blue-600">"{scheduler.keyword}"</TableCell>
                          <TableCell className="text-gray-600 text-sm">
                            <div className="flex items-center gap-2">
                              {scheduler.cronExpression && scheduler.cronExpression.includes('*/') && (
                                <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 text-xs">
                                  <Infinity className="w-3 h-3 mr-1" />
                                  Auto-Run
                                </Badge>
                              )}
                              {scheduler.cronExpression === '*/2 * * *' ? 'Every 2 minutes (Fastest)' :
                                scheduler.cronExpression === '*/3 * * *' ? 'Every 3 minutes' :
                                  scheduler.cronExpression === '*/5 * * *' ? 'Every 5 minutes' :
                                    scheduler.cronExpression === '*/10 * * *' ? 'Every 10 minutes' :
                                      scheduler.cronExpression === '*/15 * * *' ? 'Every 15 minutes' :
                                        scheduler.cronExpression === '*/30 * * *' ? 'Every 30 minutes' :
                                          scheduler.cronExpression === '0 */1 * * *' ? 'Every 1 hour' :
                                            scheduler.cronExpression === '0 */6 * * *' ? 'Every 6 hours' :
                                              scheduler.cronExpression === '0 */12 * * *' ? 'Every 12 hours' :
                                                scheduler.cronExpression === '0 0 * * *' ? 'Daily at midnight' :
                                                  scheduler.cronExpression === '0 0 * * 0' ? 'Weekly on Sunday' :
                                                    scheduler.cronExpression === '0 0 1 * *' ? 'Monthly on 1st' :
                                                      scheduler.cronExpression}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0 ${scheduler.isActive
                                ? 'bg-green-50 text-green-700 border-green-100'
                                : 'bg-red-50 text-red-700 border-red-100'
                                }`}
                            >
                              {scheduler.isActive ? 'Active' : 'Inactive'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-gray-400 text-xs">
                            {scheduler.lastRun ? new Date(scheduler.lastRun).toLocaleString() : 'Never'}
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              <div className={`font-medium ${getCountdown(scheduler.nextRun).color}`}>
                                {getCountdown(scheduler.nextRun).text}
                              </div>
                              <div className="text-xs text-gray-500 mt-1">
                                {scheduler.nextRun ? new Date(scheduler.nextRun).toLocaleTimeString('en-IN', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                  second: '2-digit'
                                }) : '--:--:--'}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-xs text-gray-500">
                              {scheduler.totalRuns > 0 ? (
                                <span>{Math.round((scheduler.successfulRuns / scheduler.totalRuns) * 100)}%</span>
                              ) : (
                                <span>-</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="w-32">
                            <div className="flex gap-1">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => updateScheduler(scheduler._id, { isActive: !scheduler.isActive })}
                                className={`cursor-pointer text-xs ${scheduler.isActive
                                  ? 'bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100'
                                  : 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'
                                  }`}
                              >
                                {scheduler.isActive ? 'Pause' : 'Start'}
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDownloadMissionAds(scheduler.keyword)}
                                className="cursor-pointer bg-green-50 text-green-700 border-green-200 hover:bg-green-100 text-xs"
                                title="Download ads for this keyword"
                              >
                                <Download className="w-3 h-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  if (confirm('Are you sure you want to delete this scheduler?')) {
                                    deleteScheduler(scheduler._id);
                                  }
                                }}
                                className="cursor-pointer hover:bg-red-50 text-red-600 hover:text-red-700 p-1"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </section>
        )}

        {/* Stored Data Table */}
        {activeSection === 'database' && (
          <section className={`${activeSection === 'database' ? 'mt-4' : 'mt-10'} animate-in fade-in duration-500`}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-4">
                <h3 className="text-xl font-bold px-1">
                  Full Ad Inventory
                </h3>
                {selectedAdIds.length > 0 && (
                  <Button
                    variant="destructive"
                    size="sm"
                    className="gap-2 bg-red-50 text-red-600 hover:bg-red-100 border border-red-200"
                    onClick={handleBulkDelete}
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete {selectedAdIds.length} Selected
                  </Button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 mr-2">
                  <label className="text-xs text-gray-500 font-medium whitespace-nowrap">Filter by Keyword:</label>
                  <select
                    value={exportKeywordFilter}
                    onChange={(e) => setExportKeywordFilter(e.target.value)}
                    className="text-xs border border-gray-200 rounded-md px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="all">All Keywords</option>
                    {(keywords || []).map(kw => (
                      <option key={kw} value={kw}>{kw}</option>
                    ))}
                  </select>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportToExcel}
                  className="cursor-pointer bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
                  disabled={ads.length === 0}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export to Excel
                </Button>
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-100 px-3">
                  {totalAds} Total Ads Stored
                </Badge>
                <Button variant="outline" size="sm" onClick={() => fetchAds()} disabled={loading} className="border-gray-100 text-gray-500 hover:bg-gray-50">
                  <Activity className="w-3.5 h-3.5 mr-2" /> Refresh
                </Button>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden ring-1 ring-gray-100">
              <Table>
                <TableHeader className="bg-gray-50/50">
                  <TableRow className="border-gray-100 h-10 hover:bg-transparent">
                    <TableHead className="w-[40px] text-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 hover:bg-transparent"
                        onClick={toggleSelectAll}
                      >
                        {selectedAdIds.length === ads.length && ads.length > 0 ? (
                          <CheckSquare className="w-4 h-4 text-blue-600" />
                        ) : (
                          <Square className="w-4 h-4 text-gray-400" />
                        )}
                      </Button>
                    </TableHead>
                    <TableHead className="font-semibold text-gray-500 text-[10px] uppercase tracking-wider w-[50px] text-center">S.No</TableHead>
                    <TableHead className="font-semibold text-gray-900 w-[180px]">Advertiser</TableHead>
                    <TableHead className="font-semibold text-gray-900">Ad Description</TableHead>
                    <TableHead className="font-semibold text-gray-900 w-[140px]">Contact</TableHead>
                    <TableHead className="font-semibold text-gray-900 w-[50px] text-center">Loc</TableHead>
                    <TableHead className="font-semibold text-gray-900 w-[120px]">Keyword</TableHead>
                    <TableHead className="font-semibold text-gray-900 w-[110px]">Scrape Date</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={8} className="h-40 text-center">
                        <div className="flex flex-col items-center justify-center gap-2 text-gray-400">
                          <Activity className="w-6 h-6 animate-spin text-blue-500" />
                          <span className="text-sm font-medium">Fetching records...</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : ads.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="h-40 text-center">
                        <div className="flex flex-col items-center justify-center gap-1 text-gray-400">
                          <Database className="w-8 h-8 mb-2 opacity-20" />
                          <p className="text-sm font-medium text-gray-500">No records found</p>
                          <p className="text-xs">Adjust filters or run a new scrape</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    ads.map((ad: any, index: number) => (
                      <TableRow key={ad._id} className="h-14 border-gray-50 hover:bg-blue-50/20 transition-colors group">
                        <TableCell className="text-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 hover:bg-transparent"
                            onClick={() => toggleSelectAd(ad._id)}
                          >
                            {selectedAdIds.includes(ad._id) ? (
                              <CheckSquare className="w-4 h-4 text-blue-600" />
                            ) : (
                              <Square className="w-4 h-4 text-gray-400 group-hover:text-blue-400 transition-colors" />
                            )}
                          </Button>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="text-xs font-medium text-gray-400">{(currentPage - 1) * 10 + index + 1}</span>
                        </TableCell>
                        <TableCell className="font-semibold text-gray-900">
                          <Tooltip content={ad.advertiser_name} className="max-w-xs whitespace-normal">
                            <div className="truncate max-w-[160px]">{ad.advertiser_name}</div>
                          </Tooltip>
                        </TableCell>
                        <TableCell>
                          <Tooltip content={ad.ad_description} className="max-w-md whitespace-normal leading-relaxed">
                            <div className="text-gray-500 line-clamp-1 group-hover:text-gray-900 transition-colors cursor-help">
                              {ad.ad_description}
                            </div>
                          </Tooltip>
                        </TableCell>
                        <TableCell>
                          {ad.phone ? (
                            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-100/50 text-xs font-mono font-medium">
                              <Activity className="w-3 h-3 text-green-500" />
                              {ad.phone}
                            </div>
                          ) : (
                            <span className="text-gray-300 text-xs">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {ad.address ? (
                            <div className="flex justify-center">
                              <Tooltip content={ad.address} className="max-w-xs whitespace-normal text-center">
                                <div className="p-1 rounded-md bg-gray-50 text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-help">
                                  <MapPin className="w-4 h-4" />
                                </div>
                              </Tooltip>
                            </div>
                          ) : (
                            <div className="flex justify-center text-gray-300">-</div>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cn(
                            "text-[10px] font-bold uppercase tracking-tight px-2 py-0",
                            ad.keyword?.includes('ADMISSION') ? "border-blue-100 text-blue-600 bg-blue-50/50" :
                              ad.keyword?.includes('MBA') ? "border-purple-100 text-purple-600 bg-purple-50/50" :
                                "border-gray-100 text-gray-500 bg-gray-50/50"
                          )}>
                            {ad.keyword}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-gray-400 text-[11px] font-medium whitespace-nowrap">
                          {new Date(ad.scrape_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-gray-300 hover:text-red-600 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all"
                            onClick={() => handleDelete(ad._id)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="mt-4 flex items-center justify-between px-2 py-1 bg-gray-50/50 rounded-lg border border-gray-100">
                <div className="text-[11px] text-gray-500 font-medium">
                  Showing <span className="text-gray-900">{(currentPage - 1) * 10 + 1}</span> - <span className="text-gray-900">{Math.min(currentPage * 10, totalAds)}</span> of <span className="text-gray-900 font-bold">{totalAds}</span> records
                </div>
                <div className="flex items-center gap-1.5">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={currentPage === 1 || loading}
                    onClick={() => setPage(currentPage - 1)}
                    className="h-7 px-2 text-xs text-gray-500 hover:text-blue-600 hover:bg-white border border-transparent hover:border-gray-200"
                  >
                    Previous
                  </Button>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum = currentPage;
                      if (currentPage <= 3) pageNum = i + 1;
                      else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
                      else pageNum = currentPage - 2 + i;

                      if (pageNum <= 0 || pageNum > totalPages) return null;

                      return (
                        <Button
                          key={pageNum}
                          variant={currentPage === pageNum ? "secondary" : "ghost"}
                          size="sm"
                          className={`h-7 w-7 p-0 text-[11px] font-bold transition-all ${currentPage === pageNum
                            ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm'
                            : 'text-gray-400 hover:text-gray-900 hover:bg-white'
                            }`}
                          onClick={() => setPage(pageNum)}
                        >
                          {pageNum}
                        </Button>
                      );
                    })}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={currentPage === totalPages || loading}
                    onClick={() => setPage(currentPage + 1)}
                    className="h-7 px-2 text-xs text-gray-500 hover:text-blue-600 hover:bg-white border border-transparent hover:border-gray-200"
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}

          </section>
        )}

        {/* Google Ads Section */}
        {activeSection === 'google-ads' && (
          <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-10">
            <div>
              <h2 className="text-3xl font-bold tracking-tight mb-1">
                Google Ads
              </h2>
              <p className="text-gray-400">
                Google Ads Transparency: Search and scrape ads from Google Ads platform.
              </p>
            </div>
            <div className="flex items-center gap-3">
              {isGoogleScraping && (
                <Badge variant={"outline" as any} className="bg-orange-50 text-orange-600 border-orange-100 animate-pulse px-3 py-1 gap-2 flex items-center">
                  <Activity className="w-3 h-3" /> Google Scraper Active
                </Badge>
              )}
            </div>
          </header>
        )}

        {activeSection === 'google-ads' && (
          <section className="mb-10 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <Card className="border-none shadow-sm bg-white ring-1 ring-gray-100 mb-6">
              <CardHeader>
                <CardTitle className="text-lg">Instant Search & Scrape</CardTitle>
                <CardDescription>Find the ads you've seen by searching by advertiser name or website.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2 items-center">
                  <form onSubmit={handleGoogleSearch} className="flex gap-2 flex-1">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <Input
                        placeholder="Search Google Ads (e.g. real estate)..."
                        className="pl-10 h-11 border-gray-100 focus:ring-blue-500"
                        value={googleKeyword}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleGoogleKeywordChange(e.target.value)}
                        onFocus={() => setShowSuggestions(true)}
                      />

                      {/* Suggestions Dropdown */}
                      {showSuggestions && googleSuggestions.length > 0 && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto">
                          {googleSuggestions.map((suggestion, index) => (
                            <div
                              key={index}
                              className="px-4 py-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                              onClick={() => selectSuggestion(suggestion)}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex-1">
                                  <p className="font-bold text-gray-900">{suggestion.advertiserName}</p>
                                  <div className="flex items-center gap-4 mt-1">
                                    <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded flex items-center gap-1">
                                      <MapPin className="w-2.5 h-2.5" /> {suggestion.basedIn}
                                    </span>
                                    <span className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-medium">
                                      {suggestion.numberOfAds} ads detected
                                    </span>
                                  </div>
                                </div>
                                <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <TrendingUp className="w-4 h-4" />
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2 items-center">
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-gray-600">Max Ads:</label>
                        <Input
                          type="number"
                          min="100"
                          value={googleMaxAds}
                          onChange={(e) => setGoogleMaxAds(parseInt(e.target.value) || 1000)}
                          className="w-24 h-11 text-sm"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-gray-600">Daily Limit:</label>
                        <Input
                          type="number"
                          min="1000"
                          value={googleDailyLimit}
                          onChange={(e) => setGoogleDailyLimit(parseInt(e.target.value) || 5000)}
                          className="w-28 h-11 text-sm"
                        />
                      </div>
                    </div>
                    <Button
                      type="submit"
                      className={`h-11 ${isGoogleScraping ? 'bg-orange-500 hover:bg-orange-600' : 'bg-blue-600 hover:bg-blue-700'} px-8 gap-2 transition-all duration-300 shadow-sm cursor-pointer`}
                      disabled={isGoogleScraping}
                    >
                      {isGoogleScraping ? (
                        <><Activity className="w-4 h-4 animate-spin" /> Scraping...</>
                      ) : (
                        <><Search className="w-4 h-4" /> Start Search</>
                      )}
                    </Button>
                  </form>
                  {isGoogleScraping && (
                    <Button
                      type="button"
                      variant="destructive"
                      className="h-11 px-6 gap-2 bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 cursor-pointer"
                      onClick={handleStopGoogleScrape}
                    >
                      <XCircle className="w-4 h-4" /> Stop
                    </Button>
                  )}
                </div>
                {isGoogleScraping && (
                  <div className="mt-4 p-4 bg-orange-50/50 rounded-xl border border-orange-100 flex items-center justify-between animate-in fade-in slide-in-from-top-1 duration-500">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 bg-orange-500 rounded-full animate-ping" />
                      <div>
                        <p className="text-sm font-semibold text-orange-900">
                          Active Google Scrape: <span className="text-blue-600">"{currentGoogleKeyword}"</span>
                        </p>
                        <p className="text-xs text-orange-600">Extracting live ads from Google Ads Transparency</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-orange-900">{ads.filter(a => a.keyword === `google_${currentGoogleKeyword}`).length} Ads Found</p>
                      <p className="text-[#A0A0A0] text-[10px] uppercase font-bold tracking-widest">Session Metrics</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Google Ads Results Table */}
            <div className="mt-10 animate-in fade-in duration-500">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold px-1">Google Ads Inventory</h3>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleExportToExcel}
                    className="cursor-pointer bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
                    disabled={ads.filter(a => a.source === 'google_ads').length === 0}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Export Google Ads
                  </Button>
                  <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-100 px-3">
                    {ads.filter(a => a.source === 'google_ads').length} Results
                  </Badge>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden ring-1 ring-gray-100">
                <Table>
                  <TableHeader className="bg-gray-50/50">
                    <TableRow className="border-gray-100">
                      <TableHead className="font-semibold text-gray-900 w-[150px]">Advertiser</TableHead>
                      <TableHead className="font-semibold text-gray-900 w-[150px]">Legal Name</TableHead>
                      <TableHead className="font-semibold text-gray-900 w-[100px]">Based In</TableHead>
                      <TableHead className="font-semibold text-gray-900">Ad Preview</TableHead>
                      <TableHead className="font-semibold text-gray-900 w-[120px]">Keyword</TableHead>
                      <TableHead className="font-semibold text-gray-900 w-[100px]">Link</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ads.filter(a => a.source === 'google_ads').length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="h-32 text-center text-gray-400 text-sm">No Google Ads data found. Start a search above.</TableCell>
                      </TableRow>
                    ) : (
                      ads.filter(a => a.source === 'google_ads').map((ad: any) => (
                        <TableRow key={ad._id} className="border-gray-100 hover:bg-gray-50/30 transition-colors group">
                          <TableCell className="font-medium text-gray-900">{ad.advertiser_name}</TableCell>
                          <TableCell className="text-gray-500 text-sm">{ad.advertiser_legal_name || '-'}</TableCell>
                          <TableCell>
                            <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded flex items-center gap-1 w-fit">
                              <MapPin className="w-2.5 h-2.5" /> {ad.based_in_country || 'India'}
                            </span>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-3 items-start">
                              {ad.image_url ? (
                                <img src={ad.image_url} alt="Ad Preview" className="w-16 h-16 object-cover rounded-md border border-gray-100" />
                              ) : (
                                <div className="w-16 h-16 bg-gray-50 rounded-md border border-gray-100 flex items-center justify-center text-gray-300">
                                  <Facebook className="w-4 h-4" />
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="text-xs text-gray-600 line-clamp-2 italic">"{ad.ad_description}"</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={"outline" as any} className="text-[10px] font-semibold uppercase tracking-wider border-gray-100 text-gray-400 bg-white">
                              {ad.keyword?.replace('google_', '')}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {ad.landing_url ? (
                              <a
                                href={ad.landing_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-[11px] text-blue-600 hover:underline font-medium"
                              >
                                View Ad <TrendingUp className="w-3 h-3" />
                              </a>
                            ) : (
                              <span className="text-gray-300 text-xs">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-gray-400 hover:text-red-600 hover:bg-red-50"
                              onClick={() => handleDelete(ad._id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </section>
        )}
      </main>

      {/* Filter Modal */}
      {showFilterModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Scraping Filters</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowFilterModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <XCircle className="w-5 h-5" />
              </Button>
            </div>

            <div className="p-6 space-y-6">
              {/* Country Filter */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Country</label>
                <div className="relative group/search">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="h-4 w-4 text-gray-400 group-focus-within/search:text-blue-500 transition-colors" />
                  </div>
                  <Input
                    type="text"
                    placeholder="Search for country..."
                    value={countrySearch}
                    onChange={(e) => setCountrySearch(e.target.value)}
                    className="pl-10 mb-2 border-gray-200 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div className="max-h-48 overflow-y-auto border border-gray-100 rounded-lg p-1 bg-gray-50/30 custom-scrollbar">
                  {COUNTRIES.filter((c: Country) =>
                    c.name.toLowerCase().includes(countrySearch.toLowerCase()) ||
                    c.code.toLowerCase().includes(countrySearch.toLowerCase())
                  ).map((c: Country) => (
                    <button
                      key={c.code}
                      onClick={() => {
                        setFilterCountry(c.code);
                        setCountrySearch('');
                      }}
                      className={cn(
                        "w-full text-left px-3 py-2 rounded-md text-sm transition-all flex items-center justify-between group",
                        filterCountry === c.code
                          ? "bg-blue-600 text-white font-medium shadow-sm"
                          : "hover:bg-blue-50 text-gray-700 hover:text-blue-700"
                      )}
                    >
                      <span>{c.name}</span>
                      <span className={cn(
                        "text-[10px] uppercase font-mono px-1.5 py-0.5 rounded border",
                        filterCountry === c.code
                          ? "border-blue-400 text-blue-100"
                          : "border-gray-200 text-gray-400 group-hover:border-blue-200 group-hover:text-blue-400"
                      )}>
                        {c.code}
                      </span>
                    </button>
                  ))}
                  {COUNTRIES.filter((c: Country) =>
                    c.name.toLowerCase().includes(countrySearch.toLowerCase()) ||
                    c.code.toLowerCase().includes(countrySearch.toLowerCase())
                  ).length === 0 && (
                      <div className="p-4 text-center text-gray-400 text-xs italic">
                        No countries found matching "{countrySearch}"
                      </div>
                    )}
                </div>
                <p className="mt-2 text-[10px] text-gray-400">Select the country to search for ads. Default is India (IN).</p>
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => { setFilterCountry('IN'); setCountrySearch(''); }}
                    className="text-[10px] px-2 py-1 bg-blue-50 text-blue-700 rounded border border-blue-100 hover:bg-blue-100 transition-colors"
                  >
                    Quick Select: India
                  </button>
                  <button
                    onClick={() => { setFilterCountry('ALL'); setCountrySearch(''); }}
                    className="text-[10px] px-2 py-1 bg-gray-50 text-gray-700 rounded border border-gray-100 hover:bg-gray-100 transition-colors"
                  >
                    Quick Select: All
                  </button>
                </div>
              </div>

              {/* Language Filter */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Language</label>
                <select
                  value={filterLanguage}
                  onChange={(e) => setFilterLanguage(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="all">All languages</option>
                  <option value="en">English</option>
                </select>
              </div>

              {/* Advertiser Filter */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Advertiser</label>
                <select
                  value={filterAdvertiser}
                  onChange={(e) => setFilterAdvertiser(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="all">All advertisers</option>
                  <option value="Fantasy Hero Country">Fantasy Hero Country</option>
                  <option value="Fantasy Reading">Fantasy Reading</option>
                  <option value="Lynn University Admission">Lynn University Admission</option>
                  <option value="Romance Novels">Romance Novels</option>
                </select>
              </div>

              {/* Platform Filter */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Platform</label>
                <div className="space-y-2">
                  {['Facebook', 'Instagram', 'Audience Network', 'Messenger', 'WhatsApp', 'Threads'].map((platform) => (
                    <label key={platform} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={filterPlatforms.includes(platform)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFilterPlatforms([...filterPlatforms, platform]);
                          } else {
                            setFilterPlatforms(filterPlatforms.filter(p => p !== platform));
                          }
                        }}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">{platform}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Media Type Filter */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Media Type</label>
                <select
                  value={filterMediaType}
                  onChange={(e) => setFilterMediaType(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="all">All media types</option>
                  <option value="image">Images</option>
                  <option value="image_no_text">Images with little to no text</option>
                  <option value="meme">Memes</option>
                  <option value="image_with_text">Images with text</option>
                  <option value="image_and_meme">Images and memes</option>
                  <option value="video">Videos</option>
                  <option value="none">No image or video</option>
                </select>
              </div>

              {/* Active Status Filter */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Active Status</label>
                <div className="space-y-2">
                  {[
                    { value: 'all', label: 'Active and inactive' },
                    { value: 'active', label: 'Active ads' },
                    { value: 'inactive', label: 'Inactive ads' }
                  ].map((option) => (
                    <label key={option.value} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="activeStatus"
                        value={option.value}
                        checked={filterActiveStatus === option.value}
                        onChange={(e) => setFilterActiveStatus(e.target.value)}
                        className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">{option.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Date Range Filter */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Impressions by Date</label>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">From:</label>
                    <Input
                      type="date"
                      value={filterStartDate}
                      onChange={(e) => setFilterStartDate(e.target.value)}
                      className="w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">To:</label>
                    <Input
                      type="date"
                      value={filterEndDate}
                      onChange={(e) => setFilterEndDate(e.target.value)}
                      className="w-full"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex items-center justify-between gap-3">
              <Button
                variant="outline"
                onClick={handleResetFilters}
                className="flex-1"
              >
                Reset Filters
              </Button>
              <Button
                onClick={handleApplyFilters}
                className="flex-1 bg-blue-600 hover:bg-blue-700"
              >
                Apply Filters
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
