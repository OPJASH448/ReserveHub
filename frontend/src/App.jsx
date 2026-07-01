import React, { useState, useEffect } from 'react';

const API_BASE = ''; // Relies on Vite proxy to forward '/api' to port 10000

export default function App() {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('user');
    return saved ? JSON.parse(saved) : null;
  });
  const [activeTab, setActiveTab] = useState('bookings');
  
  // Auth Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSuperLogin, setIsSuperLogin] = useState(false);
  const [regOrgName, setRegOrgName] = useState('');
  const [regOrgType, setRegOrgType] = useState('coworking');
  const [regUserName, setRegUserName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [authMsg, setAuthMsg] = useState('');
  const [authError, setAuthError] = useState('');

  // SuperAdmin state
  const [pendingOrgs, setPendingOrgs] = useState([]);

  // Roles Tab State
  const [roles, setRoles] = useState([]);
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleParentId, setNewRoleParentId] = useState('');
  const [roleMsg, setRoleMsg] = useState('');

  // Resources Tab State
  const [resources, setResources] = useState([]);
  const [newResName, setNewResName] = useState('');
  const [newResDesc, setNewResDesc] = useState('');
  const [newResRank, setNewResRank] = useState(2);
  const [newResDuration, setNewResDuration] = useState(60);
  const [newResStart, setNewResStart] = useState('09:00');
  const [newResEnd, setNewResEnd] = useState('17:00');
  const [resMsg, setResMsg] = useState('');

  // Booking Tab State
  const [selectedResId, setSelectedResId] = useState('');
  const [bookingDate, setBookingDate] = useState('2026-07-02');
  const [slotsData, setSlotsData] = useState(null);
  const [slotsError, setSlotsError] = useState('');
  const [bookingMsg, setBookingMsg] = useState('');

  // Inbox Tab State
  const [pendingRequests, setPendingRequests] = useState([]);
  const [inboxError, setInboxError] = useState('');

  // Cron State
  const [cronMsg, setCronMsg] = useState('');

  // Persist User
  useEffect(() => {
    if (user) {
      localStorage.setItem('user', JSON.stringify(user));
    } else {
      localStorage.removeItem('user');
    }
  }, [user]);

  // Load contextual data based on active tab and login state
  useEffect(() => {
    if (!user) return;
    
    if (user.isSuperAdmin) {
      fetchPendingOrgs();
    } else {
      if (activeTab === 'roles') fetchRoles();
      if (activeTab === 'resources') fetchResources();
      if (activeTab === 'bookings') {
        fetchResources();
        if (selectedResId) fetchSlots();
      }
      if (activeTab === 'inbox') fetchPendingRequests();
    }
  }, [user, activeTab, selectedResId, bookingDate]);

  // General fetch helper injecting token
  const fetchWithAuth = async (url, options = {}) => {
    const token = user?.accessToken;
    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...options.headers
    };
    return fetch(url, { ...options, headers });
  };

  // Login handler
  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthMsg('');
    setAuthError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed');
      setUser(data);
      setAuthMsg('Logged in successfully!');
      // Switch tab based on admin status
      if (data.user.isSuperAdmin) {
        setActiveTab('superadmin');
      } else {
        setActiveTab('bookings');
      }
    } catch (err) {
      setAuthError(err.message);
    }
  };

  // Register Org handler
  const handleRegisterOrg = async (e) => {
    e.preventDefault();
    setAuthMsg('');
    setAuthError('');
    try {
      const res = await fetch('/api/auth/register-org', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orgName: regOrgName,
          orgType: regOrgType,
          userName: regUserName,
          email: regEmail,
          password: regPassword
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Registration failed');
      setAuthMsg('Org registered successfully! Awaiting SuperAdmin approval.');
      // Clear inputs
      setRegOrgName('');
      setRegUserName('');
      setRegEmail('');
      setRegPassword('');
    } catch (err) {
      setAuthError(err.message);
    }
  };

  const handleLogout = () => {
    setUser(null);
    setActiveTab('auth');
    localStorage.removeItem('user');
  };

  // SuperAdmin operations
  const fetchPendingOrgs = async () => {
    try {
      const res = await fetchWithAuth('/api/superadmin/pending-orgs');
      const data = await res.json();
      if (res.ok) setPendingOrgs(data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleApproveOrg = async (orgId) => {
    try {
      const res = await fetchWithAuth(`/api/superadmin/approve-org/${orgId}`, { method: 'POST' });
      if (res.ok) {
        fetchPendingOrgs();
      } else {
        const data = await res.json();
        alert(data.error || 'Approval failed');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleRejectOrg = async (orgId) => {
    try {
      const res = await fetchWithAuth(`/api/superadmin/reject-org/${orgId}`, { method: 'POST' });
      if (res.ok) {
        fetchPendingOrgs();
      } else {
        const data = await res.json();
        alert(data.error || 'Rejection failed');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Roles Operations
  const fetchRoles = async () => {
    try {
      const res = await fetchWithAuth('/api/roles');
      const data = await res.json();
      if (res.ok) setRoles(data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateRole = async (e) => {
    e.preventDefault();
    setRoleMsg('');
    try {
      const res = await fetchWithAuth('/api/roles', {
        method: 'POST',
        body: JSON.stringify({
          name: newRoleName,
          parentRoleLevelId: newRoleParentId || null
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create role');
      setRoleMsg('Role created successfully!');
      setNewRoleName('');
      setNewRoleParentId('');
      fetchRoles();
    } catch (err) {
      setRoleMsg(`Error: ${err.message}`);
    }
  };

  // Resources Operations
  const fetchResources = async () => {
    try {
      const res = await fetchWithAuth('/api/resources');
      const data = await res.json();
      if (res.ok) {
        setResources(data);
        if (data.length > 0 && !selectedResId) {
          setSelectedResId(data[0]._id);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateResource = async (e) => {
    e.preventDefault();
    setResMsg('');
    try {
      const res = await fetchWithAuth('/api/resources', {
        method: 'POST',
        body: JSON.stringify({
          name: newResName,
          description: newResDesc,
          maxAllowedRank: Number(newResRank),
          slotDurationMinutes: Number(newResDuration),
          operatingHours: { start: newResStart, end: newResEnd }
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create resource');
      setResMsg('Resource created successfully!');
      setNewResName('');
      setNewResDesc('');
      fetchResources();
    } catch (err) {
      setResMsg(`Error: ${err.message}`);
    }
  };

  // Booking operations (driven by backend RBAC & status responses)
  const fetchSlots = async () => {
    if (!selectedResId) return;
    setSlotsError('');
    try {
      const res = await fetchWithAuth(`/api/resources/${selectedResId}/slots?date=${bookingDate}`);
      const data = await res.json();
      if (!res.ok) {
        // Backend returned 403 Forbidden because of user's insufficient rank
        if (res.status === 403) {
          setSlotsError(data.error || 'Access Denied: Insufficient authority');
          setSlotsData(null);
        } else {
          throw new Error(data.error || 'Failed to load slots');
        }
      } else {
        setSlotsData(data);
      }
    } catch (err) {
      setSlotsError(err.message);
      setSlotsData(null);
    }
  };

  const handleHoldSlot = async (slotStart) => {
    setBookingMsg('');
    try {
      const res = await fetchWithAuth('/api/bookings/hold', {
        method: 'POST',
        body: JSON.stringify({ resourceId: selectedResId, slotStart })
      });
      const data = await res.json();
      if (!res.ok) {
        // Intercept 409 Conflict directly from backend
        if (res.status === 409) {
          alert('Conflict: This slot is already booked or held!');
        } else {
          throw new Error(data.error || 'Booking failed');
        }
      } else {
        setBookingMsg('Slot held successfully! You have 5 minutes to confirm.');
        fetchSlots();
      }
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  };

  const handleConfirmBooking = async (bookingId) => {
    setBookingMsg('');
    try {
      const res = await fetchWithAuth(`/api/bookings/${bookingId}/confirm`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Confirmation failed');
      setBookingMsg('Booking confirmed successfully!');
      fetchSlots();
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  };

  const handleCancelBooking = async (bookingId) => {
    setBookingMsg('');
    try {
      const res = await fetchWithAuth(`/api/bookings/${bookingId}/cancel`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Cancellation failed');
      setBookingMsg('Booking cancelled successfully!');
      fetchSlots();
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  };

  const handleJoinWaitlist = async (slotStart) => {
    setBookingMsg('');
    try {
      const res = await fetchWithAuth('/api/waitlists/join', {
        method: 'POST',
        body: JSON.stringify({ resourceId: selectedResId, slotStart })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Waitlist entry failed');
      setBookingMsg(`Added to waitlist at queue position ${data.position}!`);
      fetchSlots();
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  };

  // Inbox operations (reused across all ranks)
  const fetchPendingRequests = async () => {
    setInboxError('');
    try {
      const res = await fetchWithAuth('/api/join-requests/pending');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load inbox');
      setPendingRequests(data);
    } catch (err) {
      setInboxError(err.message);
    }
  };

  const handleResolveJoinRequest = async (requestId, action) => {
    try {
      const res = await fetchWithAuth(`/api/join-requests/${requestId}/resolve`, {
        method: 'POST',
        body: JSON.stringify({ action })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Resolution failed');
      fetchPendingRequests();
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  };

  // Cron trigger (for simulation of expiry and promotions)
  const handleTriggerCron = async () => {
    setCronMsg('');
    try {
      const res = await fetch('/api/cron/expire-holds', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-cron-secret': 'cron_secret_12345'
        }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Cron execution failed');
      setCronMsg('Cron clean up ran successfully! Any holds older than 5 minutes have expired, promoting the waitlist.');
      if (selectedResId) fetchSlots();
    } catch (err) {
      setCronMsg(`Cron Error: ${err.message}`);
    }
  };

  // Template Method layout helper for role hierarchy display
  // Renders a uniform structure, customizing fields depending on rank
  const renderRoleNode = (role) => {
    let rankBadgeColor = 'bg-slate-700';
    let rankLabel = `Rank ${role.rank}`;
    if (role.rank === 0) {
      rankBadgeColor = 'bg-red-900 border-red-500';
      rankLabel = 'OrgAdmin (Rank 0)';
    } else if (role.rank === 1) {
      rankBadgeColor = 'bg-amber-900 border-amber-500';
      rankLabel = 'DeptHead (Rank 1)';
    } else if (role.rank === 2) {
      rankBadgeColor = 'bg-emerald-900 border-emerald-500';
      rankLabel = 'Teacher/Staff (Rank 2)';
    }

    const parentName = roles.find(r => r._id === role.parentRoleLevelId)?.name || 'None';

    return (
      <div key={role._id} className="border border-slate-800 p-4 rounded-xl mb-3 glass-panel flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <span className="font-semibold text-lg">{role.name}</span>
          <div className="text-xs text-slate-400 mt-1">Parent: <span className="text-slate-300 font-medium">{parentName}</span></div>
        </div>
        <div className={`px-3 py-1 text-xs border rounded-full font-medium ${rankBadgeColor}`}>
          {rankLabel}
        </div>
      </div>
    );
  };

  // Render Auth Tab if user is not logged in
  if (!user) {
    return (
      <div className="min-height-screen w-full flex flex-col justify-center items-center px-4 py-12">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold gradient-text m-0">ReserveHub</h1>
          <p className="text-slate-400 mt-2">Access Control & Slot Booking System</p>
        </div>

        <div className="w-full max-w-md glass-panel p-8">
          <div className="flex border-b border-slate-800 mb-6">
            <button
              onClick={() => setIsSuperLogin(false)}
              className={`flex-1 py-3 bg-none border-b-2 font-semibold transition-all ${!isSuperLogin ? 'border-blue-500 text-blue-500' : 'border-transparent text-slate-400'}`}
              style={{ background: 'none', boxShadow: 'none' }}
            >
              Portal Login
            </button>
            <button
              onClick={() => setIsSuperLogin(true)}
              className={`flex-1 py-3 bg-none border-b-2 font-semibold transition-all ${isSuperLogin ? 'border-blue-500 text-blue-500' : 'border-transparent text-slate-400'}`}
              style={{ background: 'none', boxShadow: 'none' }}
            >
              Org Registration
            </button>
          </div>

          {authMsg && <div className="p-3 mb-4 text-sm text-green-300 bg-green-950/50 border border-green-500/30 rounded-lg">{authMsg}</div>}
          {authError && <div className="p-3 mb-4 text-sm text-red-300 bg-red-950/50 border border-red-500/30 rounded-lg">{authError}</div>}

          {!isSuperLogin ? (
            <form onSubmit={handleLogin} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-400 font-medium">Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@org.com"
                  required
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-400 font-medium">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
              </div>
              <button type="submit" className="mt-2 py-3">Login to Dashboard</button>

              <div className="border-t border-slate-800 mt-6 pt-4 text-center">
                <div className="text-xs text-slate-500">Demo Quick Access:</div>
                <div className="flex gap-2 justify-center mt-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => { setEmail('admin@strata.com'); setPassword('SuperSecretAdmin123!'); }}
                    className="py-1 px-3 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 rounded"
                    style={{ background: '#1e293b' }}
                  >
                    SuperAdmin Login
                  </button>
                </div>
              </div>
            </form>
          ) : (
            <form onSubmit={handleRegisterOrg} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-400 font-medium">Organization Name</label>
                <input
                  type="text"
                  value={regOrgName}
                  onChange={(e) => setRegOrgName(e.target.value)}
                  placeholder="e.g. MIT Dept of Physics"
                  required
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-400 font-medium">Org Type</label>
                <select value={regOrgType} onChange={(e) => setRegOrgType(e.target.value)}>
                  <option value="school">School/College</option>
                  <option value="hospital">Hospital/Clinic</option>
                  <option value="coworking">Coworking Space</option>
                  <option value="generic">Other Company</option>
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-400 font-medium">Admin Full Name</label>
                <input
                  type="text"
                  value={regUserName}
                  onChange={(e) => setRegUserName(e.target.value)}
                  placeholder="Alice Admin"
                  required
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-400 font-medium">Admin Email</label>
                <input
                  type="email"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  placeholder="alice@org.com"
                  required
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-400 font-medium">Password</label>
                <input
                  type="password"
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
              </div>
              <button type="submit" className="mt-2 py-3 bg-purple-600 hover:bg-purple-500">Register Org</button>
            </form>
          )}
        </div>
      </div>
    );
  }

  // Render Logged-in Dashboard
  const { isSuperAdmin, name, email: userEmail, orgId } = user.user;

  return (
    <div className="w-full min-h-screen flex flex-col">
      {/* Header bar */}
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur px-6 py-4 flex justify-between items-center">
        <div>
          <h2 className="m-0 text-xl font-bold gradient-text">ReserveHub</h2>
          <div className="text-xs text-slate-400 mt-1">
            Logged in: <span className="text-slate-200 font-medium">{name}</span> {isSuperAdmin ? '(SuperAdmin)' : `(Rank ${user.user.rank === null ? 'None' : user.user.rank})`}
          </div>
        </div>
        <button onClick={handleLogout} className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs py-2 px-4 rounded-lg">
          Log Out
        </button>
      </header>

      {/* Main dashboard body */}
      <div className="flex-1 max-w-6xl w-full mx-auto px-4 py-8 flex flex-col md:flex-row gap-8">
        
        {/* Navigation Sidebar */}
        <aside className="w-full md:w-60 flex flex-col gap-2">
          {isSuperAdmin ? (
            <button
              onClick={() => setActiveTab('superadmin')}
              className={`text-left py-3 px-4 rounded-xl font-medium transition-all ${activeTab === 'superadmin' ? 'bg-blue-600/20 text-blue-400 border border-blue-500/20' : 'bg-transparent text-slate-400 hover:bg-slate-900'}`}
              style={{ background: activeTab === 'superadmin' ? 'rgba(59,130,246,0.15)' : 'none', border: activeTab === 'superadmin' ? '1px solid rgba(59,130,246,0.2)' : 'none' }}
            >
              Org Approvals
            </button>
          ) : (
            <>
              <button
                onClick={() => setActiveTab('bookings')}
                className={`text-left py-3 px-4 rounded-xl font-medium transition-all ${activeTab === 'bookings' ? 'bg-blue-600/20 text-blue-400 border border-blue-500/20' : 'bg-transparent text-slate-400 hover:bg-slate-900'}`}
                style={{ background: activeTab === 'bookings' ? 'rgba(59,130,246,0.15)' : 'none', border: activeTab === 'bookings' ? '1px solid rgba(59,130,246,0.2)' : 'none' }}
              >
                Book Resource
              </button>
              <button
                onClick={() => setActiveTab('roles')}
                className={`text-left py-3 px-4 rounded-xl font-medium transition-all ${activeTab === 'roles' ? 'bg-blue-600/20 text-blue-400 border border-blue-500/20' : 'bg-transparent text-slate-400 hover:bg-slate-900'}`}
                style={{ background: activeTab === 'roles' ? 'rgba(59,130,246,0.15)' : 'none', border: activeTab === 'roles' ? '1px solid rgba(59,130,246,0.2)' : 'none' }}
              >
                Role Levels
              </button>
              <button
                onClick={() => setActiveTab('resources')}
                className={`text-left py-3 px-4 rounded-xl font-medium transition-all ${activeTab === 'resources' ? 'bg-blue-600/20 text-blue-400 border border-blue-500/20' : 'bg-transparent text-slate-400 hover:bg-slate-900'}`}
                style={{ background: activeTab === 'resources' ? 'rgba(59,130,246,0.15)' : 'none', border: activeTab === 'resources' ? '1px solid rgba(59,130,246,0.2)' : 'none' }}
              >
                Resources
              </button>
              <button
                onClick={() => setActiveTab('inbox')}
                className={`text-left py-3 px-4 rounded-xl font-medium transition-all ${activeTab === 'inbox' ? 'bg-blue-600/20 text-blue-400 border border-blue-500/20' : 'bg-transparent text-slate-400 hover:bg-slate-900'}`}
                style={{ background: activeTab === 'inbox' ? 'rgba(59,130,246,0.15)' : 'none', border: activeTab === 'inbox' ? '1px solid rgba(59,130,246,0.2)' : 'none' }}
              >
                Approval Inbox
              </button>
            </>
          )}
          <button
            onClick={() => setActiveTab('cron')}
            className={`text-left py-3 px-4 rounded-xl font-medium transition-all ${activeTab === 'cron' ? 'bg-blue-600/20 text-blue-400 border border-blue-500/20' : 'bg-transparent text-slate-400 hover:bg-slate-900'}`}
            style={{ background: activeTab === 'cron' ? 'rgba(59,130,246,0.15)' : 'none', border: activeTab === 'cron' ? '1px solid rgba(59,130,246,0.2)' : 'none' }}
          >
            Cron Simulator
          </button>
        </aside>

        {/* Tab Contents */}
        <main className="flex-1 glass-panel p-8 min-h-[500px]">
          
          {/* TAB: SuperAdmin Approvals */}
          {activeTab === 'superadmin' && isSuperAdmin && (
            <div>
              <h3 className="text-2xl font-bold mt-0 mb-4">Pending Organizations</h3>
              <p className="text-slate-400 mb-6">Review and approve new tenant registrations.</p>
              
              {pendingOrgs.length === 0 ? (
                <div className="p-6 text-slate-500 border border-dashed border-slate-800 rounded-xl text-center">
                  No pending organizations to review.
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {pendingOrgs.map((org) => (
                    <div key={org._id} className="border border-slate-800 p-5 rounded-xl flex justify-between items-center bg-slate-900/30">
                      <div>
                        <div className="font-semibold text-lg">{org.name}</div>
                        <div className="text-sm text-slate-400 mt-1">Type: {org.type}</div>
                        <div className="text-xs text-slate-500 mt-1">Creator: {org.createdBy?.name} ({org.createdBy?.email})</div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => handleApproveOrg(org._id)} className="bg-green-600 hover:bg-green-500 text-sm py-2 px-4 rounded-lg">Approve</button>
                        <button onClick={() => handleRejectOrg(org._id)} className="bg-red-600 hover:bg-red-500 text-sm py-2 px-4 rounded-lg">Reject</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB: Roles CRUD & Hierarchy */}
          {activeTab === 'roles' && (
            <div>
              <h3 className="text-2xl font-bold mt-0 mb-4">Role Levels</h3>
              
              {/* Form (Only OrgAdmin rank 0 can create roles) */}
              {user.user.rank === 0 ? (
                <form onSubmit={handleCreateRole} className="mb-8 p-6 border border-slate-800 rounded-xl bg-slate-900/10 flex flex-col sm:flex-row items-end gap-4">
                  <div className="flex-1 flex flex-col gap-1 w-full">
                    <label className="text-xs text-slate-400 font-medium">Role Name</label>
                    <input
                      type="text"
                      value={newRoleName}
                      onChange={(e) => setNewRoleName(e.target.value)}
                      placeholder="e.g. DeptHead"
                      required
                    />
                  </div>
                  <div className="flex-1 flex flex-col gap-1 w-full">
                    <label className="text-xs text-slate-400 font-medium">Parent Role (walk-up target)</label>
                    <select value={newRoleParentId} onChange={(e) => setNewRoleParentId(e.target.value)} required>
                      <option value="">Select Parent...</option>
                      {roles.map(r => (
                        <option key={r._id} value={r._id}>{r.name} (Rank {r.rank})</option>
                      ))}
                    </select>
                  </div>
                  <button type="submit" className="py-2.5 px-6 shrink-0 w-full sm:w-auto">Define Role</button>
                </form>
              ) : (
                <div className="p-4 mb-6 text-sm text-amber-300 bg-amber-950/20 border border-amber-500/20 rounded-lg">
                  Read Only: Creating new roles requires rank-0 OrgAdmin privileges.
                </div>
              )}

              {roleMsg && <div className="p-3 mb-4 text-sm bg-slate-800/80 rounded-lg">{roleMsg}</div>}

              {/* Hierarchy View (Template Method layout) */}
              <h4 className="text-lg font-bold mb-4">Organization Hierarchy Chain</h4>
              {roles.length === 0 ? (
                <div className="p-6 text-slate-500 border border-dashed border-slate-800 rounded-xl text-center">
                  No roles defined.
                </div>
              ) : (
                <div>
                  {roles.slice().sort((a, b) => a.rank - b.rank).map(renderRoleNode)}
                </div>
              )}
            </div>
          )}

          {/* TAB: Resources CRUD */}
          {activeTab === 'resources' && (
            <div>
              <h3 className="text-2xl font-bold mt-0 mb-4">Resources</h3>

              {/* Form (Only OrgAdmin rank 0 can create resources) */}
              {user.user.rank === 0 ? (
                <form onSubmit={handleCreateResource} className="mb-8 p-6 border border-slate-800 rounded-xl bg-slate-900/10 flex flex-col gap-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-slate-400 font-medium">Resource Name</label>
                      <input
                        type="text"
                        value={newResName}
                        onChange={(e) => setNewResName(e.target.value)}
                        placeholder="e.g. Conference Room B"
                        required
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-slate-400 font-medium">Description</label>
                      <input
                        type="text"
                        value={newResDesc}
                        onChange={(e) => setNewResDesc(e.target.value)}
                        placeholder="Description of the equipment/space"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-slate-400 font-medium">Access Rank Ceiling (Max allowed rank to book)</label>
                      <input
                        type="number"
                        min="0"
                        max="10"
                        value={newResRank}
                        onChange={(e) => setNewResRank(e.target.value)}
                        required
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-slate-400 font-medium">Slot Duration (Minutes)</label>
                      <input
                        type="number"
                        value={newResDuration}
                        onChange={(e) => setNewResDuration(e.target.value)}
                        required
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-slate-400 font-medium">Operating Start</label>
                      <input
                        type="text"
                        value={newResStart}
                        onChange={(e) => setNewResStart(e.target.value)}
                        placeholder="09:00"
                        required
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-slate-400 font-medium">Operating End</label>
                      <input
                        type="text"
                        value={newResEnd}
                        onChange={(e) => setNewResEnd(e.target.value)}
                        placeholder="17:00"
                        required
                      />
                    </div>
                  </div>
                  <button type="submit" className="py-2.5 px-6 self-start mt-2">Create Resource</button>
                </form>
              ) : (
                <div className="p-4 mb-6 text-sm text-amber-300 bg-amber-950/20 border border-amber-500/20 rounded-lg">
                  Read Only: Creating resources requires rank-0 OrgAdmin privileges.
                </div>
              )}

              {resMsg && <div className="p-3 mb-4 text-sm bg-slate-800/80 rounded-lg">{resMsg}</div>}

              {/* Resources List */}
              <h4 className="text-lg font-bold mb-4">Available Resources</h4>
              {resources.length === 0 ? (
                <div className="p-6 text-slate-500 border border-dashed border-slate-800 rounded-xl text-center">
                  No resources registered yet.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {resources.map(res => (
                    <div key={res._id} className="border border-slate-800 p-5 rounded-xl glass-panel">
                      <div className="font-semibold text-lg">{res.name}</div>
                      <div className="text-sm text-slate-400 mt-1">{res.description || 'No description provided.'}</div>
                      <div className="mt-4 flex flex-wrap gap-2 text-xs">
                        <span className="bg-blue-900 border border-blue-500 px-2 py-1 rounded">Rank Allowed &lt;= {res.maxAllowedRank}</span>
                        <span className="bg-slate-800 px-2 py-1 rounded">Duration: {res.slotDurationMinutes} min</span>
                        <span className="bg-slate-800 px-2 py-1 rounded">Hours: {res.operatingHours.start} - {res.operatingHours.end}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB: Booking Gating Screen (Driven entirely by backend response) */}
          {activeTab === 'bookings' && (
            <div>
              <h3 className="text-2xl font-bold mt-0 mb-4">Book a Resource</h3>
              
              <div className="flex flex-col sm:flex-row gap-4 mb-6">
                <div className="flex-1 flex flex-col gap-1">
                  <label className="text-xs text-slate-400 font-medium">Select Resource</label>
                  <select value={selectedResId} onChange={(e) => setSelectedResId(e.target.value)}>
                    <option value="">Choose Resource...</option>
                    {resources.map(r => (
                      <option key={r._id} value={r._id}>{r.name} (Rank &lt;= {r.maxAllowedRank})</option>
                    ))}
                  </select>
                </div>
                <div className="flex-1 flex flex-col gap-1">
                  <label className="text-xs text-slate-400 font-medium">Booking Date</label>
                  <input
                    type="date"
                    value={bookingDate}
                    onChange={(e) => setBookingDate(e.target.value)}
                  />
                </div>
              </div>

              {bookingMsg && <div className="p-3 mb-4 text-sm text-green-300 bg-green-950/30 border border-green-500/20 rounded-lg">{bookingMsg}</div>}

              {/* If RBAC failure is returned by backend */}
              {slotsError ? (
                <div className="p-8 text-center border border-red-500/20 rounded-xl bg-red-950/10">
                  <div className="text-red-400 font-semibold text-lg">Access Denied</div>
                  <p className="text-slate-400 text-sm mt-2">{slotsError}</p>
                </div>
              ) : !slotsData ? (
                <div className="p-8 text-slate-500 border border-dashed border-slate-800 rounded-xl text-center">
                  Select a resource above to view available timeslots.
                </div>
              ) : (
                <div>
                  <h4 className="text-lg font-bold mb-4">Availability for {slotsData.date}</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {slotsData.slots.map((slot, index) => {
                      const timeLabel = new Date(slot.slotStart).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
                      
                      let cardBorder = 'border-slate-800';
                      let cardBg = 'bg-slate-900/10';
                      
                      if (slot.status === 'confirmed') {
                        cardBorder = 'border-red-900';
                        cardBg = 'bg-red-950/10';
                      } else if (slot.status === 'held') {
                        cardBorder = 'border-amber-900';
                        cardBg = 'bg-amber-950/10';
                      }

                      return (
                        <div key={index} className={`border p-4 rounded-xl flex flex-col justify-between gap-3 ${cardBorder} ${cardBg}`}>
                          <div>
                            <span className="font-semibold text-lg">{timeLabel}</span>
                            <div className="text-xs text-slate-400 mt-1">Status: <span className="font-medium capitalize">{slot.status}</span></div>
                          </div>

                          <div className="flex gap-2">
                            {slot.available ? (
                              <button onClick={() => handleHoldSlot(slot.slotStart)} className="text-xs py-1.5 px-3 flex-1">Hold Slot</button>
                            ) : (
                              // If held or booked
                              <>
                                {/* Show confirm/cancel if owner of hold/booking */}
                                {slot.bookingId && (
                                  <div className="flex flex-col gap-1 w-full">
                                    {slot.status === 'held' ? (
                                      <div className="flex gap-1">
                                        <button onClick={() => handleConfirmBooking(slot.bookingId)} className="text-xs py-1.5 px-2 bg-green-600 hover:bg-green-500 flex-1">Confirm</button>
                                        <button onClick={() => handleCancelBooking(slot.bookingId)} className="text-xs py-1.5 px-2 bg-slate-800 hover:bg-slate-700 text-red-400 flex-1">Release</button>
                                      </div>
                                    ) : (
                                      <button onClick={() => handleCancelBooking(slot.bookingId)} className="text-xs py-1.5 px-2 bg-slate-800 hover:bg-slate-700 text-red-400 w-full">Cancel</button>
                                    )}
                                    <button onClick={() => handleJoinWaitlist(slot.slotStart)} className="text-xs py-1 px-2 bg-purple-900/30 hover:bg-purple-900/50 border border-purple-500/20 text-purple-300 w-full mt-1">Waitlist</button>
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB: Generic Approval Inbox (reused across all ranks) */}
          {activeTab === 'inbox' && (
            <div>
              <h3 className="text-2xl font-bold mt-0 mb-4">Approval Inbox</h3>
              <p className="text-slate-400 mb-6">Review join requests routed to your level by the Chain of Responsibility resolver.</p>

              {inboxError && <div className="p-3 mb-4 text-sm text-red-300 bg-red-950/30 border border-red-500/20 rounded-lg">{inboxError}</div>}

              {pendingRequests.length === 0 ? (
                <div className="p-6 text-slate-500 border border-dashed border-slate-800 rounded-xl text-center">
                  No pending requests to resolve.
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {pendingRequests.map((req) => (
                    <div key={req._id} className="border border-slate-800 p-5 rounded-xl flex justify-between items-center bg-slate-900/30">
                      <div>
                        <div className="font-semibold text-lg">{req.userId?.name}</div>
                        <div className="text-sm text-slate-400 mt-1">Email: {req.userId?.email}</div>
                        <div className="text-xs text-slate-500 mt-1">Requested Role: <span className="text-blue-400 font-medium">{req.requestedRoleLevelId?.name} (Rank {req.requestedRoleLevelId?.rank})</span></div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => handleResolveJoinRequest(req._id, 'approve')} className="bg-green-600 hover:bg-green-500 text-sm py-2 px-4 rounded-lg">Approve</button>
                        <button onClick={() => handleResolveJoinRequest(req._id, 'reject')} className="bg-red-600 hover:bg-red-500 text-sm py-2 px-4 rounded-lg">Reject</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB: Cron Simulator */}
          {activeTab === 'cron' && (
            <div>
              <h3 className="text-2xl font-bold mt-0 mb-4">Cron Simulator</h3>
              <p className="text-slate-400 mb-6">Simulate the background runner that clean up expired holds and promotes waitlisted users.</p>
              
              <div className="p-6 border border-slate-800 rounded-xl bg-slate-900/20 flex flex-col items-start gap-4">
                <div>
                  <div className="font-semibold text-lg">Expire Holds Cron Job</div>
                  <div className="text-sm text-slate-400 mt-1">Endpoint: <code>POST /api/cron/expire-holds</code></div>
                  <div className="text-xs text-slate-500 mt-1">Triggered with header <code>x-cron-secret: cron_secret_12345</code></div>
                </div>
                <button onClick={handleTriggerCron} className="bg-purple-600 hover:bg-purple-500 py-2.5 px-6">Trigger Cron Expirations</button>
              </div>

              {cronMsg && <div className="mt-4 p-4 text-sm bg-slate-800/80 rounded-lg">{cronMsg}</div>}
            </div>
          )}

        </main>
      </div>
    </div>
  );
}
