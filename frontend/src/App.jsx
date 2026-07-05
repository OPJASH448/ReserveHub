import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  LogOut, Users, Layers, Calendar, Building2, Mail, Clock,
  ImagePlus, ChevronRight, X, Check, AlertTriangle,
  Inbox, Search, Shield, Star, Zap, Loader2,
  UserCircle, Edit3, Trash2, Filter, ChevronDown,
  Bell, ArrowRight, Sparkles, Activity,
  Home, Lock
} from 'lucide-react';
import { uploadResourceImage } from './supabase';

const API_BASE = '';

let toastId = 0;
let toastListeners = [];

function showToast(message, type = 'info') {
  const id = ++toastId;
  toastListeners.forEach(fn => fn({ id, message, type }));
  setTimeout(() => {
    toastListeners.forEach(fn => fn(null));
  }, 3500);
}

function ToastContainer() {
  const [toast, setToast] = useState(null);

  useEffect(() => {
    const listener = (t) => setToast(t);
    toastListeners.push(listener);
    return () => { toastListeners = toastListeners.filter(fn => fn !== listener); };
  }, []);

  if (!toast) return null;

  const icons = { success: <Check size={16} />, error: <AlertTriangle size={16} />, info: <Shield size={16} /> };
  return (
    <div className={`toast toast-${toast.type}`}>
      {icons[toast.type]}
      <span>{toast.message}</span>
    </div>
  );
}

function SkeletonCard({ height = 120 }) {
  return <div className="skeleton" style={{ height, borderRadius: 12 }} />;
}

function SkeletonGrid({ count = 6 }) {
  return (
    <div className="resource-grid">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="resource-card">
          <div className="skeleton skeleton-img" />
          <div style={{ padding: 16 }}>
            <div className="skeleton" style={{ height: 16, width: '70%', marginBottom: 8 }} />
            <div className="skeleton" style={{ height: 12, width: '100%', marginBottom: 6 }} />
            <div className="skeleton" style={{ height: 12, width: '50%' }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function SkeletonSlots() {
  return (
    <div className="slots-grid">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="slot-card" style={{ minHeight: 100 }}>
          <div className="skeleton" style={{ height: 16, width: '40%' }} />
          <div className="skeleton" style={{ height: 12, width: '60%' }} />
        </div>
      ))}
    </div>
  );
}

function SkeletonList({ count = 4 }) {
  return (
    <div className="queue-list">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="request-card">
          <div className="request-info">
            <div className="skeleton" style={{ width: 40, height: 40, borderRadius: 10 }} />
            <div>
              <div className="skeleton" style={{ height: 14, width: 120, marginBottom: 6 }} />
              <div className="skeleton" style={{ height: 11, width: 180 }} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function BookingCalendar({ bookings }) {
  const [currentMonth, setCurrentMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();

  const monthLabel = currentMonth.toLocaleString('en-US', { month: 'long', year: 'numeric' });

  const bookingsByDate = {};
  bookings.forEach(b => {
    const d = new Date(b.slotStart);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (!bookingsByDate[key]) bookingsByDate[key] = [];
    bookingsByDate[key].push(b);
  });

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const statusColors = {
    confirmed: 'var(--emerald)',
    held: 'var(--gold)',
    cancelled: 'var(--rose)',
    expired: 'var(--text-muted)'
  };

  return (
    <div className="card">
      <div className="calendar-header">
        <button onClick={() => setCurrentMonth(new Date(year, month - 1, 1))} className="btn btn-ghost btn-sm" style={{ padding: '4px 8px' }}>
          <ChevronRight size={16} style={{ transform: 'rotate(180deg)' }} />
        </button>
        <span className="calendar-month-label">{monthLabel}</span>
        <button onClick={() => setCurrentMonth(new Date(year, month + 1, 1))} className="btn btn-ghost btn-sm" style={{ padding: '4px 8px' }}>
          <ChevronRight size={16} />
        </button>
      </div>
      <div className="calendar-grid">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
          <div key={d} className="calendar-weekday">{d}</div>
        ))}
        {cells.map((day, i) => {
          if (day === null) return <div key={`empty-${i}`} className="calendar-cell calendar-cell-empty" />;
          const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const dayBookings = bookingsByDate[key] || [];
          const isToday = today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;
          return (
            <div key={day} className={`calendar-cell ${isToday ? 'calendar-today' : ''} ${dayBookings.length > 0 ? 'calendar-has-events' : ''}`}>
              <span className="calendar-day-num">{day}</span>
              {dayBookings.length > 0 && (
                <div className="calendar-dots">
                  {dayBookings.slice(0, 3).map((b, j) => (
                    <span key={j} className="calendar-dot" style={{ background: statusColors[b.status] || 'var(--text-muted)' }} title={`${b.resourceId?.name || '?'} — ${b.status}`} />
                  ))}
                  {dayBookings.length > 3 && <span className="calendar-more">+{dayBookings.length - 3}</span>}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="calendar-legend">
        <span className="calendar-legend-item"><span className="calendar-dot" style={{ background: 'var(--emerald)' }} /> Confirmed</span>
        <span className="calendar-legend-item"><span className="calendar-dot" style={{ background: 'var(--gold)' }} /> Held</span>
        <span className="calendar-legend-item"><span className="calendar-dot" style={{ background: 'var(--rose)' }} /> Cancelled</span>
      </div>
    </div>
  );
}

/* ═══ Command Palette Component ═══════════════════════════════════ */
function CommandPalette({ isOpen, onClose, navItems, onNavigate, userName }) {
  const [query, setQuery] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const filteredNav = navItems.filter(item =>
    item.label.toLowerCase().includes(query.toLowerCase())
  );

  const handleSelect = (id) => {
    onNavigate(id);
    onClose();
  };

  return (
    <div className="command-palette-overlay" onClick={onClose}>
      <div className="command-palette-backdrop" />
      <div className="command-palette" onClick={(e) => e.stopPropagation()}>
        <div className="command-palette-input-wrap">
          <Search size={18} />
          <input
            ref={inputRef}
            className="command-palette-input"
            placeholder="Type a command or search..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') onClose();
              if (e.key === 'Enter' && filteredNav.length > 0) handleSelect(filteredNav[0].id);
            }}
          />
          <span className="command-palette-kbd">ESC</span>
        </div>
        <div className="command-palette-results">
          <div className="command-palette-group-label">Navigation</div>
          {filteredNav.map(item => {
            const Icon = item.icon;
            return (
              <button key={item.id} className="command-palette-item" onClick={() => handleSelect(item.id)}>
                <Icon size={16} />
                <span>{item.label}</span>
                <span className="command-palette-item-shortcut"><ArrowRight size={12} /></span>
              </button>
            );
          })}
          {filteredNav.length === 0 && (
            <div style={{ padding: '16px 12px', color: 'var(--text-muted)', fontSize: 13 }}>
              No results found for "{query}"
            </div>
          )}
        </div>
        <div className="command-palette-footer">
          <span><kbd>↑↓</kbd> navigate</span>
          <span><kbd>↵</kbd> select</span>
          <span><kbd>esc</kbd> close</span>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('user');
    return saved ? JSON.parse(saved) : null;
  });
  const [activeTab, setActiveTab] = useState('dashboard');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [regUserName, setRegUserName] = useState('');
  const [authMsg, setAuthMsg] = useState('');
  const [authError, setAuthError] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [roles, setRoles] = useState([]);
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleParentId, setNewRoleParentId] = useState('');
  const [roleMsg, setRoleMsg] = useState('');
  const [myOrgs, setMyOrgs] = useState([]);
  const [createOrgName, setCreateOrgName] = useState('');
  const [createOrgType, setCreateOrgType] = useState('coworking');
  const [createOrgMsg, setCreateOrgMsg] = useState('');
  const [createOrgError, setCreateOrgError] = useState('');
  const [resources, setResources] = useState([]);
  const [newResName, setNewResName] = useState('');
  const [newResDesc, setNewResDesc] = useState('');
  const [newResImage, setNewResImage] = useState('');
  const [newResQuantity, setNewResQuantity] = useState(1);
  const [newResRank, setNewResRank] = useState(2);
  const [newResDuration, setNewResDuration] = useState(60);
  const [resMsg, setResMsg] = useState('');
  const [selectedResId, setSelectedResId] = useState('');
  const [bookingDate, setBookingDate] = useState(new Date().toISOString().split('T')[0]);
  const [slotsData, setSlotsData] = useState(null);
  const [slotsError, setSlotsError] = useState('');
  const [bookingMsg, setBookingMsg] = useState('');
  const [pendingQueueRequests, setPendingQueueRequests] = useState([]);
  const [queueError, setQueueError] = useState('');
  const [publicOrgs, setPublicOrgs] = useState([]);
  const [selectOrgForQueue, setSelectOrgForQueue] = useState('');
  const [selectRoleForQueue, setSelectRoleForQueue] = useState('');
  const [queueMsg, setQueueMsg] = useState('');
  const [availableRoles, setAvailableRoles] = useState([]);
  const [cronMsg, setCronMsg] = useState('');
  const [imageUploading, setImageUploading] = useState(false);
  const [resourceQueues, setResourceQueues] = useState({});
  const [waitlistModal, setWaitlistModal] = useState(null);
  const fileInputRef = useRef(null);

  const [myBookings, setMyBookings] = useState([]);
  const [bookingsLoading, setBookingsLoading] = useState(false);
  const [resourcesLoading, setResourcesLoading] = useState(false);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [queueRequestsLoading, setQueueRequestsLoading] = useState(false);
  const [resourceSearch, setResourceSearch] = useState('');
  const [resourceRankFilter, setResourceRankFilter] = useState('');
  const [editingResource, setEditingResource] = useState(null);
  const [editResName, setEditResName] = useState('');
  const [editResDesc, setEditResDesc] = useState('');
  const [editResQuantity, setEditResQuantity] = useState(1);
  const [editResRank, setEditResRank] = useState(2);
  const [editResDuration, setEditResDuration] = useState(60);

  const [profileModal, setProfileModal] = useState(false);
  const [profileData, setProfileData] = useState(null);
  const [members, setMembers] = useState([]);
  const [memberSearch, setMemberSearch] = useState('');
  const [membersLoading, setMembersLoading] = useState(false);
  const [bookingViewMode, setBookingViewMode] = useState('list');

  /* ═══ New UI State ═══════════════════════════════════════════════ */
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const profileDropdownRef = useRef(null);
  const notificationRef = useRef(null);

  useEffect(() => {
    if (user) {
      localStorage.setItem('user', JSON.stringify(user));
      fetchProfile();
    } else {
      localStorage.removeItem('user');
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    if (activeTab === 'join') fetchPublicOrgs();
    if (activeTab === 'roles') { fetchRoles(); fetchMyOrgs(); }
    if (activeTab === 'resources') fetchResources();
    if (activeTab === 'bookings') { fetchResources(); if (selectedResId) fetchSlots(); }
    if (activeTab === 'my-bookings') fetchMyBookings();
    if (activeTab === 'queue') fetchPendingQueueRequests();
    if (activeTab === 'members') fetchMembers();
    if (activeTab === 'dashboard') { fetchResources(); fetchMyBookings(); fetchPendingQueueRequests(); }
  }, [user, activeTab, selectedResId, bookingDate]);

  /* ═══ Keyboard shortcut for Command Palette ════════════════════ */
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCommandPaletteOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  /* ═══ Click outside to close dropdowns ═════════════════════════ */
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(e.target)) {
        setShowProfileDropdown(false);
      }
      if (notificationRef.current && !notificationRef.current.contains(e.target)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchWithAuth = async (url, options = {}) => {
    const token = user?.accessToken;
    const headers = { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}), ...options.headers };
    const res = await fetch(url, { ...options, headers });
    if (res.status === 401 && user) {
      showToast('Session expired. Please log in again.', 'error');
      setUser(null);
      localStorage.removeItem('user');
    }
    return res;
  };

  const handleLogout = () => { setUser(null); setActiveTab('dashboard'); localStorage.removeItem('user'); };

  const fetchPublicOrgs = async () => {
    try { const res = await fetch('/api/auth/list-orgs'); const data = await res.json(); if (res.ok) setPublicOrgs(data); } catch (err) { console.error(err); }
  };

  const fetchOrgRoles = async (orgId) => {
    try { const res = await fetch(`/api/auth/org-roles/${orgId}`); const data = await res.json(); if (res.ok) setAvailableRoles(data); } catch (err) { console.error(err); }
  };

  const handleJoinQueue = async (e) => {
    e.preventDefault(); setQueueMsg(''); setQueueError('');
    if (!selectOrgForQueue || !selectRoleForQueue) { setQueueError('Please select both organization and role'); return; }
    try {
      const res = await fetchWithAuth('/api/waiting-queue/join', { method: 'POST', body: JSON.stringify({ orgId: selectOrgForQueue, requestedRoleLevelId: selectRoleForQueue }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to join queue');
      showToast(`Successfully joined queue at position ${data.position}!`, 'success');
      setSelectOrgForQueue(''); setSelectRoleForQueue(''); setAvailableRoles([]);
    } catch (err) { setQueueError(err.message); showToast(err.message, 'error'); }
  };

  const fetchMyOrgs = async () => {
    try { const res = await fetchWithAuth('/api/auth/my-orgs'); const data = await res.json(); if (res.ok) setMyOrgs(data); } catch (err) { console.error(err); }
  };

  const handleSwitchOrg = async (orgId) => {
    try {
      const res = await fetchWithAuth(`/api/auth/switch-org/${orgId}`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) { setUser(data); setSelectedResId(''); setSlotsData(null); setSlotsError(''); showToast('Switched organization', 'success'); setTimeout(() => { fetchRoles(); fetchResources(); fetchMyOrgs(); }, 50); }
      else showToast(data.error || 'Failed to switch organization', 'error');
    } catch (err) { console.error(err); }
  };

  const handleCreateOrg = async (e) => {
    e.preventDefault(); setCreateOrgMsg(''); setCreateOrgError('');
    try {
      const res = await fetchWithAuth('/api/auth/create-org', { method: 'POST', body: JSON.stringify({ orgName: createOrgName, orgType: createOrgType }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create organization');
      showToast('Organization created! You are now OrgAdmin.', 'success');
      setCreateOrgName(''); setUser(data);
      setTimeout(() => { fetchMyOrgs(); fetchRoles(); fetchResources(); }, 50);
    } catch (err) { setCreateOrgError(err.message); showToast(err.message, 'error'); }
  };

  const fetchRoles = async () => {
    try { const res = await fetchWithAuth('/api/roles'); const data = await res.json(); if (res.ok) setRoles(data); } catch (err) { console.error(err); }
  };

  const handleCreateRole = async (e) => {
    e.preventDefault(); setRoleMsg('');
    try {
      const res = await fetchWithAuth('/api/roles', { method: 'POST', body: JSON.stringify({ name: newRoleName, parentRoleLevelId: newRoleParentId || null }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create role');
      showToast('Role created!', 'success'); setNewRoleName(''); setNewRoleParentId(''); fetchRoles();
    } catch (err) { showToast(err.message, 'error'); }
  };

  const fetchResources = async () => {
    setResourcesLoading(true);
    try {
      const res = await fetchWithAuth('/api/resources');
      const data = await res.json();
      if (res.ok) { setResources(data); if (data.length > 0 && !selectedResId) setSelectedResId(data[0]._id); }
    } catch (err) { console.error(err); }
    setResourcesLoading(false);
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageUploading(true);
    try { const url = await uploadResourceImage(file); setNewResImage(url); }
    catch (err) { showToast(`Upload failed: ${err.message}`, 'error'); }
    finally { setImageUploading(false); }
  };

  const handleCreateResource = async (e) => {
    e.preventDefault(); setResMsg('');
    try {
      const res = await fetchWithAuth('/api/resources', { method: 'POST', body: JSON.stringify({ name: newResName, description: newResDesc, image: newResImage, quantity: Number(newResQuantity), maxAllowedRank: Number(newResRank), slotDurationMinutes: Number(newResDuration), operatingHours: { start: '05:00', end: '22:00' } }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create resource');
      showToast('Resource created!', 'success');
      setNewResName(''); setNewResDesc(''); setNewResImage(''); setNewResQuantity(1);
      fetchResources();
    } catch (err) { showToast(err.message, 'error'); }
  };

  const handleUpdateResource = async (e) => {
    e.preventDefault();
    if (!editingResource) return;
    try {
      const res = await fetchWithAuth(`/api/resources/${editingResource._id}`, { method: 'PUT', body: JSON.stringify({ name: editResName, description: editResDesc, quantity: Number(editResQuantity), maxAllowedRank: Number(editResRank), slotDurationMinutes: Number(editResDuration) }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update resource');
      showToast('Resource updated!', 'success');
      setEditingResource(null);
      fetchResources();
    } catch (err) { showToast(err.message, 'error'); }
  };

  const handleDeleteResource = async (resId) => {
    if (!window.confirm('Delete this resource? This cannot be undone.')) return;
    try {
      const res = await fetchWithAuth(`/api/resources/${resId}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete resource');
      showToast('Resource deleted', 'success');
      if (selectedResId === resId) { setSelectedResId(''); setSlotsData(null); }
      fetchResources();
    } catch (err) { showToast(err.message, 'error'); }
  };

  const fetchSlots = async () => {
    if (!selectedResId) return; setSlotsError(''); setSlotsLoading(true);
    try {
      const res = await fetchWithAuth(`/api/resources/${selectedResId}/slots?date=${bookingDate}`);
      const data = await res.json();
      if (!res.ok) { if (res.status === 403) { setSlotsError(data.error || 'Access Denied'); setSlotsData(null); } else throw new Error(data.error || 'Failed to load slots'); }
      else setSlotsData(data);
    } catch (err) { setSlotsError(err.message); setSlotsData(null); }
    setSlotsLoading(false);
  };

  const handleHoldSlot = async (slotStart) => {
    setBookingMsg('');
    try {
      const res = await fetchWithAuth('/api/bookings/hold', { method: 'POST', body: JSON.stringify({ resourceId: selectedResId, slotStart }) });
      const data = await res.json();
      if (!res.ok) { if (res.status === 409) showToast('This slot is already booked or held!', 'error'); else throw new Error(data.error || 'Booking failed'); }
      else { showToast('Slot held! You have 3 minutes to confirm.', 'success'); fetchSlots(); }
    } catch (err) { showToast(err.message, 'error'); }
  };

  const handleConfirmBooking = async (bookingId) => {
    setBookingMsg('');
    try {
      const res = await fetchWithAuth(`/api/bookings/${bookingId}/confirm`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Confirmation failed');
      showToast('Booking confirmed!', 'success'); fetchSlots();
    } catch (err) { showToast(err.message, 'error'); }
  };

  const handleCancelBooking = async (bookingId) => {
    setBookingMsg('');
    try {
      const res = await fetchWithAuth(`/api/bookings/${bookingId}/cancel`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Cancellation failed');
      showToast('Booking cancelled', 'success'); fetchSlots();
    } catch (err) { showToast(err.message, 'error'); }
  };

  const handleJoinWaitlist = async (slotStart) => {
    setBookingMsg('');
    try {
      const res = await fetchWithAuth('/api/waitlists/join', { method: 'POST', body: JSON.stringify({ resourceId: selectedResId, slotStart }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Waitlist entry failed');
      showToast(`Added to waitlist at position ${data.position}!`, 'success'); fetchSlots();
    } catch (err) { showToast(err.message, 'error'); }
  };

  const fetchPendingQueueRequests = async () => {
    setQueueError(''); setQueueRequestsLoading(true);
    try {
      const res = await fetchWithAuth('/api/waiting-queue/pending');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load pending requests');
      setPendingQueueRequests(data);
    } catch (err) { setQueueError(err.message); }
    setQueueRequestsLoading(false);
  };

  const handleResolveQueue = async (queueId, action) => {
    try {
      const res = await fetchWithAuth(`/api/waiting-queue/${queueId}/resolve`, { method: 'POST', body: JSON.stringify({ action }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Resolution failed');
      fetchPendingQueueRequests();
      showToast(data.message || 'Request resolved', 'success');
    } catch (err) { showToast(err.message, 'error'); }
  };

  const handleTriggerCron = async () => {
    setCronMsg('');
    try {
      const res = await fetch('/api/cron/expire-holds', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-cron-secret': 'cron_secret_12345' } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Cron execution failed');
      showToast('Cron job completed!', 'success');
      if (selectedResId) fetchSlots();
    } catch (err) { showToast(err.message, 'error'); }
  };

  const fetchResourceQueue = async (resourceId) => {
    try {
      const res = await fetchWithAuth(`/api/waitlists/resource/${resourceId}`);
      const data = await res.json();
      if (res.ok) setResourceQueues(prev => ({ ...prev, [resourceId]: data }));
    } catch (err) { console.error(err); }
  };

  const fetchMyBookings = async () => {
    setBookingsLoading(true);
    try {
      const res = await fetchWithAuth('/api/bookings/my-bookings');
      const data = await res.json();
      if (res.ok) setMyBookings(data);
    } catch (err) { console.error(err); }
    setBookingsLoading(false);
  };

  const fetchProfile = async () => {
    try {
      const res = await fetchWithAuth('/api/members/me');
      const data = await res.json();
      if (res.ok) setProfileData(data);
      else showToast(data.error || 'Failed to load profile', 'error');
    } catch (err) { showToast('Network error loading profile', 'error'); console.error(err); }
  };

  const fetchMembers = async (query = '') => {
    setMembersLoading(true);
    try {
      const url = query ? `/api/members?q=${encodeURIComponent(query)}` : '/api/members';
      const res = await fetchWithAuth(url);
      const data = await res.json();
      if (res.ok) setMembers(data);
    } catch (err) { console.error(err); }
    setMembersLoading(false);
  };

  const handleMemberSearch = (val) => {
    setMemberSearch(val);
    fetchMembers(val);
  };

  const exportBookingsCSV = () => {
    try {
      if (myBookings.length === 0) return;
      const headers = ['Resource', 'Date', 'Start Time', 'End Time', 'Status'];
      const rows = myBookings.map(b => {
        const start = new Date(b.slotStart);
        const end = new Date(b.slotEnd);
        return [
          b.resourceId?.name || 'Deleted',
          start.toLocaleDateString('en-US'),
          start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }),
          end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }),
          b.status
        ];
      });
      const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `bookings-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('CSV exported!', 'success');
    } catch (err) { showToast('Failed to export CSV', 'error'); }
  };

  const openEditResource = (res) => {
    setEditingResource(res);
    setEditResName(res.name);
    setEditResDesc(res.description || '');
    setEditResQuantity(res.quantity);
    setEditResRank(res.maxAllowedRank);
    setEditResDuration(res.slotDurationMinutes);
  };

  const handleAutoAuth = async (e) => {
    e.preventDefault(); setAuthMsg(''); setAuthError('');
    try {
      if (isSignUp) {
        if (!regUserName.trim()) { setAuthError('Please enter your full name.'); return; }
        const regRes = await fetch('/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: regUserName, email, password }) });
        const regData = await regRes.json();
        if (!regRes.ok) { setAuthError(regData.error || 'Registration failed'); return; }
        const autoLogin = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
        if (autoLogin.ok) { const data = await autoLogin.json(); setUser(data); setEmail(''); setPassword(''); setRegUserName(''); setIsSignUp(false); setActiveTab('dashboard'); }
        return;
      }
      const loginRes = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
      if (loginRes.ok) { const data = await loginRes.json(); setUser(data); setEmail(''); setPassword(''); setRegUserName(''); setActiveTab('dashboard'); return; }
      const loginData = await loginRes.json();
      setAuthError(loginData.error || 'Login failed');
    } catch (err) { setAuthError(err.message); }
  };

  const filteredResources = resources.filter(r => {
    const matchesSearch = !resourceSearch || r.name.toLowerCase().includes(resourceSearch.toLowerCase()) || (r.description || '').toLowerCase().includes(resourceSearch.toLowerCase());
    const matchesRank = resourceRankFilter === '' || r.maxAllowedRank === Number(resourceRankFilter);
    return matchesSearch && matchesRank;
  });

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Home },
    { id: 'resources', label: 'Resources', icon: Layers },
    { id: 'bookings', label: 'Book Slots', icon: Calendar },
    { id: 'my-bookings', label: 'My Bookings', icon: UserCircle },
    { id: 'members', label: 'Members', icon: Users },
    { id: 'join', label: 'Join Org', icon: Mail },
    { id: 'roles', label: 'My Org', icon: Building2 },
    { id: 'queue', label: 'Approvals', icon: Star },
    { id: 'cron', label: 'Cron', icon: Clock },
  ];

  const renderRoleNode = (role) => {
    let rankBadgeColor = 'badge-slate';
    let rankLabel = `Level ${role.rank}`;
    if (role.rank === 0) { rankBadgeColor = 'badge-rank-0'; rankLabel = 'OrgAdmin (Level 0)'; }
    else if (role.rank === 1) { rankBadgeColor = 'badge-rank-1'; }
    else if (role.rank === 2) { rankBadgeColor = 'badge-rank-2'; }
    else if (role.rank === 3) { rankBadgeColor = 'badge-rank-3'; }
    const parentName = roles.find(r => r._id === role.parentRoleLevelId)?.name || 'None';
    return (
      <div key={role._id} className="card">
        <div className="card-header">
          <div className="card-title">{role.name}</div>
          <span className={`badge ${rankBadgeColor}`}>{rankLabel}</span>
        </div>
        <div className="card-desc">Parent: {parentName}</div>
      </div>
    );
  };

  const getBookingStatusBadge = (status) => {
    switch (status) {
      case 'confirmed': return <span className="badge badge-emerald">Confirmed</span>;
      case 'held': return <span className="badge badge-gold">Held</span>;
      case 'cancelled': return <span className="badge badge-rose">Cancelled</span>;
      case 'expired': return <span className="badge badge-slate">Expired</span>;
      default: return <span className="badge badge-slate">{status}</span>;
    }
  };

  const getRankBadgeClass = (rank) => {
    if (rank === 0) return 'badge-rank-0';
    if (rank === 1) return 'badge-rank-1';
    if (rank === 2) return 'badge-rank-2';
    if (rank === 3) return 'badge-rank-3';
    return 'badge-slate';
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  /* ═══ Login Page (Split-Screen Glass Card) ═══════════════════════ */
  if (!user) {
    return (
      <div className="auth-page">
        <div className="auth-hero">
          <h1 className="auth-hero-title">Smart Resource Management</h1>
          <p className="auth-hero-desc">
            Streamline your organization's resource booking with role-based access control, smart scheduling, and real-time availability tracking.
          </p>
          <div className="auth-hero-features">
            <div className="auth-hero-feature"><Zap size={18} /> <span>Intelligent slot booking with conflict detection</span></div>
            <div className="auth-hero-feature"><Shield size={18} /> <span>Role-based access control & hierarchy</span></div>
            <div className="auth-hero-feature"><Users size={18} /> <span>Multi-organization support & queuing</span></div>
            <div className="auth-hero-feature"><Activity size={18} /> <span>Real-time waitlist & auto-promotion</span></div>
          </div>
          <div className="auth-hero-stats">
            <div className="auth-hero-stat">
              <span className="auth-hero-stat-value">99.9%</span>
              <span className="auth-hero-stat-label">Uptime</span>
            </div>
            <div className="auth-hero-stat">
              <span className="auth-hero-stat-value">50ms</span>
              <span className="auth-hero-stat-label">Avg Response</span>
            </div>
            <div className="auth-hero-stat">
              <span className="auth-hero-stat-value">256-bit</span>
              <span className="auth-hero-stat-label">Encryption</span>
            </div>
          </div>
        </div>
        <div className="auth-card">
          <div className="auth-header">
            <div className="auth-logo"><Shield size={28} strokeWidth={1.5} /></div>
            <h1 className="auth-title">ReserveHub</h1>
            <p className="auth-subtitle">Sign in to your account or create a new one</p>
          </div>
          {authMsg && <div className="alert alert-success">{authMsg}</div>}
          {authError && <div className="alert alert-error">{authError}</div>}
          <div className="auth-tabs">
            <button className={`auth-tab ${!isSignUp ? 'active' : ''}`} onClick={() => setIsSignUp(false)}>Sign In</button>
            <button className={`auth-tab ${isSignUp ? 'active' : ''}`} onClick={() => setIsSignUp(true)}>Sign Up</button>
          </div>
          <form onSubmit={handleAutoAuth} className="auth-form">
            {isSignUp && <div className="form-group">
              <label className="form-label">Full Name</label>
              <input type="text" value={regUserName} onChange={(e) => setRegUserName(e.target.value)} placeholder="Alice Smith" required={isSignUp} />
            </div>}
            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" required />
            </div>
            <div className="form-group">
              <label className="form-label">Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required />
            </div>
            <button type="submit" className="btn btn-primary btn-full">
              <ArrowRight size={16} /> {isSignUp ? 'Create Account' : 'Sign In'}
            </button>
            <div className="auth-trust">
              <Lock size={12} /> <span>Your data is encrypted and secure</span>
            </div>
          </form>
        </div>
        <ToastContainer />
      </div>
    );
  }

  const { name = 'User' } = user.user || {};
  const confirmedBookings = myBookings.filter(b => b.status === 'confirmed');
  const heldBookings = myBookings.filter(b => b.status === 'held');

  return (
    <div className="app">
      <ToastContainer />

      {/* ═══ Enhanced Header with Profile Dropdown + Notifications ════ */}
      <header className="header">
        <div className="header-inner">
          <div className="header-brand" style={{ cursor: 'pointer' }} onClick={() => setActiveTab('dashboard')}>
            <div className="header-avatar"><Shield size={20} strokeWidth={1.5} /></div>
            <div>
              <h1 className="header-title">ReserveHub</h1>
              <div className="header-user">
                <span className="header-user-name">{user.user.orgId?.name || 'No Org'}</span>
              </div>
            </div>
          </div>
          <div className="header-right">
            {/* Command Palette Trigger */}
            <button className="header-kbd-hint" onClick={() => setCommandPaletteOpen(true)}>
              <Search size={13} />
              <span>Search</span>
              <kbd>⌘K</kbd>
            </button>

            {/* Notification Bell */}
            <div style={{ position: 'relative' }} ref={notificationRef}>
              <button className="header-icon-btn" onClick={() => setShowNotifications(!showNotifications)}>
                <Bell size={18} />
                {pendingQueueRequests.length > 0 && <span className="notification-dot" />}
              </button>
              {showNotifications && (
                <div className="notification-panel">
                  <div className="notification-panel-header">
                    <span className="notification-panel-title">Notifications</span>
                    {pendingQueueRequests.length > 0 && (
                      <span className="badge badge-violet" style={{ fontSize: 10 }}>{pendingQueueRequests.length} pending</span>
                    )}
                  </div>
                  <div className="notification-panel-body">
                    {pendingQueueRequests.length === 0 && heldBookings.length === 0 ? (
                      <div className="notification-empty">
                        <Bell size={28} strokeWidth={1} />
                        <p>All caught up! No new notifications.</p>
                      </div>
                    ) : (
                      <>
                        {heldBookings.slice(0, 3).map(b => (
                          <div key={b._id} className="notification-item" onClick={() => { setActiveTab('my-bookings'); setShowNotifications(false); }}>
                            <div className="notification-item-icon warning"><Clock size={16} /></div>
                            <div className="notification-item-content">
                              <div className="notification-item-title">Booking On Hold</div>
                              <div className="notification-item-desc">{b.resourceId?.name || 'Resource'} — Confirm before it expires</div>
                              <div className="notification-item-time">Action needed</div>
                            </div>
                          </div>
                        ))}
                        {pendingQueueRequests.slice(0, 5).map(req => (
                          <div key={req._id} className="notification-item" onClick={() => { setActiveTab('queue'); setShowNotifications(false); }}>
                            <div className="notification-item-icon info"><Users size={16} /></div>
                            <div className="notification-item-content">
                              <div className="notification-item-title">Join Request</div>
                              <div className="notification-item-desc">{req.userId?.name} wants to join as {req.requestedRoleLevelId?.name}</div>
                              <div className="notification-item-time">Pending approval</div>
                            </div>
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Profile Dropdown */}
            <div style={{ position: 'relative' }} ref={profileDropdownRef}>
              <button className="profile-trigger" onClick={() => setShowProfileDropdown(!showProfileDropdown)}>
                <div className="profile-trigger-avatar">{name?.charAt(0)?.toUpperCase()}</div>
                <div className="profile-trigger-info">
                  <div className="profile-trigger-name">{name}</div>
                  <div className="profile-trigger-role">{user.user.rank === null || user.user.rank === undefined ? 'Pending' : `Level ${user.user.rank}`}</div>
                </div>
                <ChevronDown size={14} className="profile-trigger-chevron" />
              </button>
              {showProfileDropdown && (
                <div className="profile-dropdown">
                  <div className="dropdown-header">
                    <div className="dropdown-avatar">{name?.charAt(0)?.toUpperCase()}</div>
                    <div className="dropdown-user-info">
                      <div className="dropdown-user-name">{name}</div>
                      <div className="dropdown-user-email">{user.user.email}</div>
                    </div>
                  </div>
                  <button className="dropdown-item" onClick={() => { setProfileModal(true); fetchProfile(); setShowProfileDropdown(false); }}>
                    <UserCircle size={16} /> My Profile
                  </button>
                  <button className="dropdown-item" onClick={() => { setActiveTab('roles'); setShowProfileDropdown(false); }}>
                    <Building2 size={16} /> My Organization
                  </button>
                  <button className="dropdown-item" onClick={() => { setActiveTab('my-bookings'); setShowProfileDropdown(false); }}>
                    <Calendar size={16} /> My Bookings
                  </button>
                  <div className="dropdown-divider" />
                  <button className="dropdown-item dropdown-item-danger" onClick={() => { handleLogout(); setShowProfileDropdown(false); }}>
                    <LogOut size={16} /> Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="layout">
        <aside className="sidebar">
          <nav className="sidebar-nav">
            <div className="sidebar-section-label">Overview</div>
            {navItems.slice(0, 1).map(item => {
              const Icon = item.icon;
              return (
                <button key={item.id} onClick={() => setActiveTab(item.id)} className={`nav-btn ${activeTab === item.id ? 'active' : ''}`}>
                  <Icon size={18} strokeWidth={1.8} />
                  <span>{item.label}</span>
                </button>
              );
            })}
            <div className="sidebar-section-label">Booking</div>
            {navItems.slice(1, 4).map(item => {
              const Icon = item.icon;
              return (
                <button key={item.id} onClick={() => setActiveTab(item.id)} className={`nav-btn ${activeTab === item.id ? 'active' : ''}`}>
                  <Icon size={18} strokeWidth={1.8} />
                  <span>{item.label}</span>
                </button>
              );
            })}
            <div className="sidebar-section-label">Organization</div>
            {navItems.slice(4).map(item => {
              const Icon = item.icon;
              return (
                <button key={item.id} onClick={() => setActiveTab(item.id)} className={`nav-btn ${activeTab === item.id ? 'active' : ''}`}>
                  <Icon size={18} strokeWidth={1.8} />
                  <span>{item.label}</span>
                  {item.id === 'queue' && pendingQueueRequests.length > 0 && (
                    <span className="nav-badge">{pendingQueueRequests.length}</span>
                  )}
                </button>
              );
            })}
          </nav>
        </aside>

        <main className="main">
          {/* ═══ Dashboard Tab ═══════════════════════════════════════ */}
          {activeTab === 'dashboard' && (
            <div className="page">
              {/* Hero */}
              <div className="dashboard-hero">
                <div className="dashboard-hero-content">
                  <div className="dashboard-greeting">
                    <span className="dashboard-greeting-dot" />
                    {getGreeting()}, {name?.split(' ')[0]}
                  </div>
                  <h2 className="dashboard-hero-title">Welcome to ReserveHub</h2>
                  <p className="dashboard-hero-desc">
                    Manage your resources, book slots, and stay on top of your organization's scheduling — all in one place.
                  </p>
                </div>
              </div>

              {/* Stat Cards */}
              <div className="dashboard-stats">
                <div className="stat-card" style={{ '--stat-accent': 'var(--violet)' }} onClick={() => setActiveTab('resources')}>
                  <div className="stat-card-header">
                    <div className="stat-card-icon violet"><Layers size={20} /></div>
                  </div>
                  <div className="stat-card-value">{resources.length}</div>
                  <div className="stat-card-label">Total Resources</div>
                </div>
                <div className="stat-card" style={{ '--stat-accent': 'var(--emerald)' }} onClick={() => setActiveTab('my-bookings')}>
                  <div className="stat-card-header">
                    <div className="stat-card-icon emerald"><Check size={20} /></div>
                  </div>
                  <div className="stat-card-value">{confirmedBookings.length}</div>
                  <div className="stat-card-label">Confirmed Bookings</div>
                </div>
                <div className="stat-card" style={{ '--stat-accent': 'var(--gold)' }} onClick={() => setActiveTab('my-bookings')}>
                  <div className="stat-card-header">
                    <div className="stat-card-icon gold"><Clock size={20} /></div>
                  </div>
                  <div className="stat-card-value">{heldBookings.length}</div>
                  <div className="stat-card-label">Held Slots</div>
                </div>
                <div className="stat-card" style={{ '--stat-accent': 'var(--sky)' }} onClick={() => setActiveTab('queue')}>
                  <div className="stat-card-header">
                    <div className="stat-card-icon sky"><Star size={20} /></div>
                  </div>
                  <div className="stat-card-value">{pendingQueueRequests.length}</div>
                  <div className="stat-card-label">Pending Approvals</div>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="section-label">Quick Actions</div>
              <div className="quick-actions">
                <button className="quick-action-card" onClick={() => setActiveTab('bookings')}>
                  <div className="quick-action-icon violet"><Calendar size={20} /></div>
                  <div>
                    <div className="quick-action-title">Book a Slot</div>
                    <div className="quick-action-desc">Reserve a time slot for a resource</div>
                  </div>
                </button>
                <button className="quick-action-card" onClick={() => setActiveTab('resources')}>
                  <div className="quick-action-icon emerald"><Layers size={20} /></div>
                  <div>
                    <div className="quick-action-title">Manage Resources</div>
                    <div className="quick-action-desc">Create or edit organization resources</div>
                  </div>
                </button>
                <button className="quick-action-card" onClick={() => setActiveTab('join')}>
                  <div className="quick-action-icon sky"><Mail size={20} /></div>
                  <div>
                    <div className="quick-action-title">Join Organization</div>
                    <div className="quick-action-desc">Request to join a new team</div>
                  </div>
                </button>
              </div>

              {/* Recent Bookings */}
              {myBookings.length > 0 && (
                <>
                  <div className="section-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Recent Bookings</span>
                    <button className="btn btn-ghost btn-sm" onClick={() => setActiveTab('my-bookings')}>
                      View All <ChevronRight size={14} />
                    </button>
                  </div>
                  <div className="queue-list">
                    {myBookings.slice(0, 3).map(b => {
                      const slotTime = new Date(b.slotStart);
                      const end = new Date(b.slotEnd);
                      const dateStr = slotTime.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
                      const startStr = slotTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
                      const endStr = end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
                      return (
                        <div key={b._id} className="request-card">
                          <div className="request-info">
                            <div className="request-avatar">{b.resourceId?.name?.charAt(0) || '?'}</div>
                            <div>
                              <div className="request-name">{b.resourceId?.name || 'Deleted Resource'}</div>
                              <div className="request-email">{dateStr} — {startStr} to {endStr}</div>
                              <div style={{ marginTop: 6 }}>{getBookingStatusBadge(b.status)}</div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}

          {activeTab === 'resources' && (
            <div className="page">
              <div className="page-header">
                <h2 className="page-title">Resources</h2>
                <p className="page-desc">Create and manage bookable resources in your organization</p>
              </div>
              <div className="card">
                <h3 className="card-section-title">Create New Resource</h3>
                <form onSubmit={handleCreateResource} className="form">
                  <div className="form-grid">
                    <div className="form-group">
                      <label className="form-label">Resource Name</label>
                      <input type="text" value={newResName} onChange={(e) => setNewResName(e.target.value)} placeholder="e.g. Conference Room B" required />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Description</label>
                      <input type="text" value={newResDesc} onChange={(e) => setNewResDesc(e.target.value)} placeholder="Short description" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Image</label>
                      <div className="upload-area" onClick={() => fileInputRef.current?.click()}>
                        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="upload-input" />
                        {imageUploading ? (
                          <div className="upload-placeholder"><Loader2 size={20} className="spin" /><span>Uploading...</span></div>
                        ) : newResImage ? (
                          <div className="upload-preview">
                            <img src={newResImage} alt="Preview" />
                            <button type="button" className="upload-remove" onClick={(e) => { e.stopPropagation(); setNewResImage(''); }}><X size={14} /></button>
                          </div>
                        ) : (
                          <div className="upload-placeholder"><ImagePlus size={20} /><span>Click to upload image</span></div>
                        )}
                      </div>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Quantity Available</label>
                      <input type="number" min="1" value={newResQuantity} onChange={(e) => setNewResQuantity(e.target.value)} required />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Max Access Level</label>
                      <input type="number" min="0" max="10" value={newResRank} onChange={(e) => setNewResRank(e.target.value)} required />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Slot Duration (min)</label>
                      <input type="number" value={newResDuration} onChange={(e) => setNewResDuration(e.target.value)} required />
                    </div>
                  </div>
                  <button type="submit" className="btn btn-primary">Create Resource</button>
                </form>
              </div>

              <div className="resource-list-header">
                <h3 className="section-label">Available Resources</h3>
                <div className="resource-controls">
                  <div className="search-input-wrap">
                    <Search size={14} />
                    <input type="text" value={resourceSearch} onChange={(e) => setResourceSearch(e.target.value)} placeholder="Search resources..." />
                  </div>
                  <div className="filter-wrap">
                    <Filter size={14} />
                    <select value={resourceRankFilter} onChange={(e) => setResourceRankFilter(e.target.value)}>
                      <option value="">All Levels</option>
                      {[0, 1, 2, 3, 4, 5].map(r => <option key={r} value={r}>Level {r}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              {resourcesLoading ? <SkeletonGrid /> : filteredResources.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon"><Layers size={28} strokeWidth={1.5} /></div>
                  <h3 className="empty-state-title">{resources.length === 0 ? 'No resources yet' : 'No results found'}</h3>
                  <p>{resources.length === 0 ? 'Create your first bookable resource to get started with slot management.' : 'Try adjusting your search or filter criteria.'}</p>
                  {resources.length === 0 && (
                    <button className="btn btn-primary btn-sm" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
                      <Sparkles size={14} /> Create First Resource
                    </button>
                  )}
                </div>
              ) : (
                <div className="resource-grid">
                  {filteredResources.map(res => (
                    <div key={res._id} className="resource-card" onMouseEnter={() => fetchResourceQueue(res._id)}>
                      {res.image && <img src={res.image} alt={res.name} className="resource-img" />}
                      <div className="resource-body">
                        <div className="resource-header">
                          <h4 className="resource-name">{res.name}</h4>
                          <span className={`badge ${getRankBadgeClass(res.maxAllowedRank)}`}>Lvl {res.maxAllowedRank}</span>
                        </div>
                        <p className="resource-desc">{res.description || 'No description'}</p>
                        <div className="resource-meta">
                          <span><Zap size={12} /> {res.quantity} available</span>
                          <span><Clock size={12} /> {res.slotDurationMinutes}m slots</span>
                        </div>
                        <div className="resource-actions">
                          <button onClick={() => openEditResource(res)} className="btn btn-ghost btn-sm" style={{ padding: '4px 8px' }}>
                            <Edit3 size={13} /> Edit
                          </button>
                          <button onClick={() => handleDeleteResource(res._id)} className="btn btn-ghost btn-sm" style={{ padding: '4px 8px', color: 'var(--ro-lt)' }}>
                            <Trash2 size={13} /> Delete
                          </button>
                        </div>
                      </div>
                      {resourceQueues[res._id] && resourceQueues[res._id].length > 0 && (
                        <div className="resource-queue">
                          <div className="queue-label"><Users size={13} /><span>Waiting Queue</span></div>
                          <div className="queue-scroll">
                            {resourceQueues[res._id].map((entry) => (
                              <div key={entry._id} className="queue-chip">
                                <span className="queue-pos">#{entry.position}</span>
                                <span className="queue-name">{entry.userId?.name || 'Unknown'}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {editingResource && (
                <div className="modal-overlay" onClick={() => setEditingResource(null)}>
                  <div className="modal-backdrop" />
                  <div className="modal" onClick={(e) => e.stopPropagation()}>
                    <div className="modal-header">
                      <div>
                        <h3 className="modal-title">Edit Resource</h3>
                        <p className="modal-subtitle">{editingResource.name}</p>
                      </div>
                      <button className="modal-close" onClick={() => setEditingResource(null)}><X size={18} /></button>
                    </div>
                    <div className="modal-body">
                      <form onSubmit={handleUpdateResource} className="form">
                        <div className="form-group">
                          <label className="form-label">Name</label>
                          <input type="text" value={editResName} onChange={(e) => setEditResName(e.target.value)} required />
                        </div>
                        <div className="form-group">
                          <label className="form-label">Description</label>
                          <input type="text" value={editResDesc} onChange={(e) => setEditResDesc(e.target.value)} />
                        </div>
                        <div className="form-grid">
                          <div className="form-group">
                            <label className="form-label">Quantity</label>
                            <input type="number" min="1" value={editResQuantity} onChange={(e) => setEditResQuantity(e.target.value)} required />
                          </div>
                          <div className="form-group">
                            <label className="form-label">Max Access Level</label>
                            <input type="number" min="0" max="10" value={editResRank} onChange={(e) => setEditResRank(e.target.value)} required />
                          </div>
                          <div className="form-group">
                            <label className="form-label">Slot Duration (min)</label>
                            <input type="number" value={editResDuration} onChange={(e) => setEditResDuration(e.target.value)} required />
                          </div>
                        </div>
                        <button type="submit" className="btn btn-primary btn-full">Save Changes</button>
                      </form>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'bookings' && (
            <div className="page">
              <div className="page-header">
                <h2 className="page-title">Book a Resource</h2>
                <p className="page-desc">Reserve time slots for available resources</p>
              </div>
              <div className="card">
                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">Select Resource</label>
                    <select value={selectedResId} onChange={(e) => setSelectedResId(e.target.value)}>
                      <option value="">Choose Resource...</option>
                      {resources.map(r => (<option key={r._id} value={r._id}>{r.name} ({r.quantity} available)</option>))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Booking Date</label>
                    <input type="date" value={bookingDate} onChange={(e) => setBookingDate(e.target.value)} />
                  </div>
                </div>
              </div>
              {slotsLoading ? <SkeletonSlots /> : slotsError ? (
                <div className="card" style={{ textAlign: 'center', padding: 40 }}>
                  <AlertTriangle size={36} strokeWidth={1.2} style={{ color: 'var(--gold)', marginBottom: 12, opacity: 0.6 }} />
                  <div className="card-section-title" style={{ marginBottom: 4 }}>Could not load slots</div>
                  <p className="card-desc" style={{ marginBottom: 16 }}>{slotsError}</p>
                  <button onClick={fetchSlots} className="btn btn-outline btn-sm">
                    <Zap size={14} /> Retry
                  </button>
                </div>
              ) : !slotsData ? (
                <div className="empty-state">
                  <div className="empty-state-icon"><Calendar size={28} strokeWidth={1.5} /></div>
                  <h3 className="empty-state-title">Select a Resource</h3>
                  <p>Choose a resource and date above to view available time slots for booking.</p>
                </div>
              ) : (
                <div>
                  <div className="section-label" style={{ marginBottom: 16 }}>Slots for {slotsData.date}</div>
                  <div className="slots-grid">
                    {slotsData.slots.map((slot) => {
                      const timeLabel = new Date(slot.slotStart).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
                      let slotClass = 'available';
                      if (slot.status === 'confirmed') slotClass = 'confirmed';
                      else if (slot.status === 'held') slotClass = 'held';
                      const isOwner = slot.bookingUserId === user?.user?.id;
                      return (
                        <div key={slot.slotStart} className={`slot-card ${slotClass}`}>
                          <div className="slot-top">
                            <div className="slot-time">{timeLabel}</div>
                            <div className={`slot-status status-${slotClass}`}>{slot.status}</div>
                          </div>
                          {slot.waitlistCount > 0 && (
                            <button className="slot-waitlist-btn" onClick={() => setWaitlistModal({ time: timeLabel, date: slotsData.date, users: slot.waitlistUsers })}>
                              <Users size={12} /><span>{slot.waitlistCount} waiting</span><ChevronRight size={12} />
                            </button>
                          )}
                          {slot.available ? (
                            <button onClick={() => handleHoldSlot(slot.slotStart)} className="btn btn-primary btn-sm btn-full">Hold Slot</button>
                          ) : (
                            slot.bookingId && (
                              <div className="slot-actions">
                                {slot.status === 'held' && isOwner && (
                                  <>
                                    <button onClick={() => handleConfirmBooking(slot.bookingId)} className="btn btn-emerald btn-sm btn-full"><Check size={14} /> Confirm</button>
                                    <button onClick={() => handleCancelBooking(slot.bookingId)} className="btn btn-rose btn-sm btn-full"><X size={14} /> Release</button>
                                  </>
                                )}
                                {slot.status === 'confirmed' && isOwner && (
                                  <button onClick={() => handleCancelBooking(slot.bookingId)} className="btn btn-rose btn-sm btn-full"><X size={14} /> Cancel</button>
                                )}
                                {!slot.available && (
                                  slot.userInWaitlist ? (
                                    <div className="btn btn-outline btn-sm btn-full" style={{ opacity: 0.6, cursor: 'default' }}><Check size={14} /> Already in Queue</div>
                                  ) : (
                                    <button onClick={() => handleJoinWaitlist(slot.slotStart)} className="btn btn-outline btn-sm btn-full">Join Waitlist</button>
                                  )
                                )}
                              </div>
                            )
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'my-bookings' && (
            <div className="page">
              <div className="page-header">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                  <div>
                    <h2 className="page-title">My Bookings</h2>
                    <p className="page-desc">View and manage your booking history</p>
                  </div>
                  {myBookings.length > 0 && (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => setBookingViewMode('list')} className={`btn btn-sm ${bookingViewMode === 'list' ? 'btn-primary' : 'btn-ghost'}`}><Layers size={14} /> List</button>
                      <button onClick={() => setBookingViewMode('calendar')} className={`btn btn-sm ${bookingViewMode === 'calendar' ? 'btn-primary' : 'btn-ghost'}`}><Calendar size={14} /> Calendar</button>
                      <button onClick={exportBookingsCSV} className="btn btn-sm btn-ghost"><Inbox size={14} /> Export CSV</button>
                    </div>
                  )}
                </div>
              </div>
              {bookingsLoading ? <SkeletonList count={5} /> : myBookings.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon"><Calendar size={28} strokeWidth={1.5} /></div>
                  <h3 className="empty-state-title">No bookings yet</h3>
                  <p>You haven't made any reservations. Head to the booking page to reserve your first slot.</p>
                  <button className="btn btn-primary btn-sm" onClick={() => setActiveTab('bookings')}>
                    <Calendar size={14} /> Book a Slot
                  </button>
                </div>
              ) : bookingViewMode === 'list' ? (
                <div className="queue-list">
                  {myBookings.map((b) => {
                    const slotTime = new Date(b.slotStart);
                    const end = new Date(b.slotEnd);
                    const dateStr = slotTime.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
                    const startStr = slotTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
                    const endStr = end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
                    return (
                      <div key={b._id} className="request-card">
                        <div className="request-info">
                          <div className="request-avatar">{b.resourceId?.name?.charAt(0) || '?'}</div>
                          <div>
                            <div className="request-name">{b.resourceId?.name || 'Deleted Resource'}</div>
                            <div className="request-email">{dateStr} — {startStr} to {endStr}</div>
                            <div style={{ marginTop: 6 }}>{getBookingStatusBadge(b.status)}</div>
                          </div>
                        </div>
                        <div className="request-actions">
                          {b.status === 'held' && (
                            <>
                              <button onClick={() => handleConfirmBooking(b._id)} className="btn btn-emerald btn-sm"><Check size={14} /> Confirm</button>
                              <button onClick={() => handleCancelBooking(b._id)} className="btn btn-rose btn-sm"><X size={14} /> Cancel</button>
                            </>
                          )}
                          {b.status === 'confirmed' && (
                            <button onClick={() => handleCancelBooking(b._id)} className="btn btn-rose btn-sm"><X size={14} /> Cancel</button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <BookingCalendar bookings={myBookings} />
              )}
            </div>
          )}

          {activeTab === 'join' && (
            <div className="page">
              <div className="page-header">
                <h2 className="page-title">Join an Organization</h2>
                <p className="page-desc">Request to join an organization and get assigned to a role</p>
              </div>
              <div className="card">
                {queueMsg && <div className="alert alert-success">{queueMsg}</div>}
                {queueError && <div className="alert alert-error">{queueError}</div>}
                <form onSubmit={handleJoinQueue} className="form">
                  <div className="form-grid">
                    <div className="form-group">
                      <label className="form-label">Select Organization</label>
                      <select value={selectOrgForQueue} onChange={(e) => { setSelectOrgForQueue(e.target.value); if (e.target.value) fetchOrgRoles(e.target.value); }} required>
                        <option value="">Choose Organization...</option>
                        {publicOrgs.map(org => <option key={org._id} value={org._id}>{org.name}</option>)}
                      </select>
                    </div>
                    {availableRoles.length > 0 && (
                      <div className="form-group">
                        <label className="form-label">Request Role</label>
                        <select value={selectRoleForQueue} onChange={(e) => setSelectRoleForQueue(e.target.value)} required>
                          <option value="">Choose Role...</option>
                          {availableRoles.map(role => <option key={role._id} value={role._id}>{role.name} (Level {role.rank})</option>)}
                        </select>
                      </div>
                    )}
                  </div>
                  <button type="submit" className="btn btn-primary" disabled={!selectOrgForQueue || !selectRoleForQueue}>Submit Join Request</button>
                </form>
              </div>
              {publicOrgs.length === 0 && (
                <div className="empty-state">
                  <div className="empty-state-icon"><Building2 size={28} strokeWidth={1.5} /></div>
                  <h3 className="empty-state-title">No organizations available</h3>
                  <p>There are no public organizations to join right now. You can create your own!</p>
                  <button className="btn btn-primary btn-sm" onClick={() => setActiveTab('roles')}>
                    <Building2 size={14} /> Create Organization
                  </button>
                </div>
              )}
            </div>
          )}

          {activeTab === 'roles' && (
            <div className="page">
              <div className="page-header">
                <h2 className="page-title">My Organization</h2>
                <p className="page-desc">Manage organizations and role hierarchy</p>
              </div>
              <div className="card">
                <h3 className="card-section-title">Create New Organization</h3>
                <form onSubmit={handleCreateOrg} className="form">
                  <div className="form-grid">
                    <div className="form-group">
                      <label className="form-label">Organization Name</label>
                      <input type="text" value={createOrgName} onChange={(e) => setCreateOrgName(e.target.value)} placeholder="e.g. Stanford Medical Center" required />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Organization Type</label>
                      <select value={createOrgType} onChange={(e) => setCreateOrgType(e.target.value)} required>
                        <option value="school">School / College</option>
                        <option value="hospital">Hospital / Clinic</option>
                        <option value="coworking">Coworking Space</option>
                        <option value="generic">Other Company</option>
                      </select>
                    </div>
                  </div>
                  <button type="submit" className="btn btn-primary">Create Organization</button>
                </form>
                {createOrgMsg && <div className="alert alert-success">{createOrgMsg}</div>}
                {createOrgError && <div className="alert alert-error">{createOrgError}</div>}
              </div>

              <div className="section-label">Your Organizations</div>
              {myOrgs.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon"><Building2 size={28} strokeWidth={1.5} /></div>
                  <h3 className="empty-state-title">No organizations</h3>
                  <p>You haven't joined any organizations yet. Create one above or join an existing one.</p>
                  <button className="btn btn-primary btn-sm" onClick={() => setActiveTab('join')}>
                    <Mail size={14} /> Join Organization
                  </button>
                </div>
              ) : (
                <div className="resource-grid">
                  {myOrgs.map((org) => {
                    const isActive = org.isMember;
                    return (
                      <div key={org._id} className={`resource-card ${isActive ? 'card-active' : ''}`}>
                        <div className="resource-body">
                          <div className="resource-header">
                            <h4 className="resource-name">{org.name}</h4>
                            {isActive && <span className="badge badge-emerald">Current</span>}
                          </div>
                          <p className="resource-desc">{org.type}</p>
                          {isActive && org.memberRole && (
                            <div className="org-role-info">
                              <Shield size={13} /><span>{org.memberRole.name}</span>
                              <span className={`badge ${getRankBadgeClass(org.memberRole.rank)}`} style={{ marginLeft: 'auto' }}>Level {org.memberRole.rank}</span>
                            </div>
                          )}
                          {!isActive && <button onClick={() => handleSwitchOrg(org._id)} className="btn btn-sky btn-sm btn-full" style={{ marginTop: 12 }}>Switch to Org</button>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="divider" />
              <div className="section-label">Role Hierarchy</div>
              {user?.user?.rank === 0 && (
                <div className="card" style={{ marginBottom: 20 }}>
                  <h3 className="card-section-title" style={{ color: 'var(--vi-lt)' }}>Define New Role</h3>
                  <form onSubmit={handleCreateRole} className="form">
                    <div className="form-grid">
                      <div className="form-group">
                        <label className="form-label">Role Name</label>
                        <input type="text" value={newRoleName} onChange={(e) => setNewRoleName(e.target.value)} placeholder="e.g. Manager" required />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Parent Role</label>
                        <select value={newRoleParentId} onChange={(e) => setNewRoleParentId(e.target.value)} required>
                          <option value="">Select Parent...</option>
                          {roles.map(r => (<option key={r._id} value={r._id}>{r.name} (Level {r.rank})</option>))}
                        </select>
                      </div>
                    </div>
                    <button type="submit" className="btn btn-primary">Define Role</button>
                  </form>
                  {roleMsg && <div className={`alert ${roleMsg.startsWith('Error') ? 'alert-error' : 'alert-success'}`}>{roleMsg}</div>}
                </div>
              )}
              {roles.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon"><Shield size={28} strokeWidth={1.5} /></div>
                  <h3 className="empty-state-title">No roles defined</h3>
                  <p>Define roles to set up your organization's access hierarchy and permissions.</p>
                </div>
              ) : (
                <div className="resource-grid">{roles.slice().sort((a, b) => a.rank - b.rank).map(renderRoleNode)}</div>
              )}
            </div>
          )}

          {activeTab === 'queue' && (
            <div className="page">
              <div className="page-header">
                <h2 className="page-title">Approval Queue</h2>
                <p className="page-desc">Review and approve join requests from users</p>
              </div>
              {queueError && <div className="alert alert-error">{queueError}</div>}
              {queueRequestsLoading ? <SkeletonList /> : pendingQueueRequests.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon"><Inbox size={28} strokeWidth={1.5} /></div>
                  <h3 className="empty-state-title">All caught up!</h3>
                  <p>There are no pending join requests to review. New requests will appear here automatically.</p>
                </div>
              ) : (
                <div className="queue-list">
                  {pendingQueueRequests.map((req) => (
                    <div key={req._id} className="request-card">
                      <div className="request-info">
                        <div className="request-avatar">{req.userId?.name?.charAt(0)}</div>
                        <div>
                          <div className="request-name">{req.userId?.name}</div>
                          <div className="request-email">{req.userId?.email}</div>
                          <div className="request-role">Requested: <span className="text-blue">{req.requestedRoleLevelId?.name} (Level {req.requestedRoleLevelId?.rank})</span></div>
                          <div className="request-pos">Queue position: <span className="font-bold">#{req.position}</span></div>
                        </div>
                      </div>
                      <div className="request-actions">
                        <button onClick={() => handleResolveQueue(req._id, 'approve')} className="btn btn-emerald btn-sm"><Check size={14} /> Approve</button>
                        <button onClick={() => handleResolveQueue(req._id, 'reject')} className="btn btn-rose btn-sm"><X size={14} /> Reject</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'members' && (
            <div className="page">
              <div className="page-header">
                <h2 className="page-title">Organization Members</h2>
                <p className="page-desc">Browse and search members in your organization</p>
              </div>
              <div className="card" style={{ padding: '12px 16px' }}>
                <div className="search-input-wrap" style={{ background: 'rgba(255,255,255,0.02)' }}>
                  <Search size={16} />
                  <input
                    type="text"
                    value={memberSearch}
                    onChange={(e) => handleMemberSearch(e.target.value)}
                    placeholder="Search by name or email..."
                    style={{ fontSize: 14 }}
                  />
                  {memberSearch && (
                    <button onClick={() => handleMemberSearch('')} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 2, display: 'flex' }}>
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>
              {membersLoading ? <SkeletonList count={6} /> : members.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon"><Users size={28} strokeWidth={1.5} /></div>
                  <h3 className="empty-state-title">{memberSearch ? 'No results' : 'No members yet'}</h3>
                  <p>{memberSearch ? 'No members match your search. Try a different query.' : 'No members in this organization yet. Invite people to join!'}</p>
                </div>
              ) : (
                <div className="queue-list">
                  {members.map((m) => {
                    const roleRank = m.roleLevelId?.rank;
                    const roleName = m.roleLevelId?.name || 'Unassigned';
                    const rankBadge = getRankBadgeClass(roleRank);
                    const memberSince = new Date(m.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                    const isCurrentUser = m._id === user?.user?.id;
                    return (
                      <div key={m._id} className="request-card" style={isCurrentUser ? { borderColor: 'rgba(99,102,241,0.3)', background: 'rgba(99,102,241,0.03)' } : {}}>
                        <div className="request-info">
                          <div className="request-avatar" style={isCurrentUser ? { background: 'linear-gradient(135deg, var(--violet), var(--sky))', color: '#fff' } : {}}>
                            {m.name?.charAt(0)?.toUpperCase()}
                          </div>
                          <div>
                            <div className="request-name">
                              {m.name}
                              {isCurrentUser && <span className="badge badge-premium" style={{ marginLeft: 8, fontSize: 10 }}>You</span>}
                            </div>
                            <div className="request-email">{m.email}</div>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6, flexWrap: 'wrap' }}>
                              <span className={`badge ${rankBadge}`}>{roleName} {roleRank !== null && roleRank !== undefined && `(Lvl ${roleRank})`}</span>
                              <span className={`badge ${m.status === 'active' ? 'badge-emerald' : 'badge-gold'}`}>
                                {m.status === 'active' ? 'Active' : m.status === 'pending' ? 'Pending' : 'Rejected'}
                              </span>
                              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Joined {memberSince}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === 'cron' && (
            <div className="page">
              <div className="page-header">
                <h2 className="page-title">Cron Simulator</h2>
                <p className="page-desc">Manually trigger background jobs</p>
              </div>
              <div className="card">
                <h3 className="card-section-title">Expire Holds Cron Job</h3>
                <p className="card-desc" style={{ marginBottom: 20 }}>Clean up expired holds and promote waitlisted users</p>
                <button onClick={handleTriggerCron} className="btn btn-gold"><Zap size={16} /> Trigger Cron Job</button>
              </div>
              {cronMsg && <div className="alert alert-info">{cronMsg}</div>}
            </div>
          )}
        </main>
      </div>

      {/* ═══ Command Palette (Ctrl+K) ═══════════════════════════════ */}
      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        navItems={navItems}
        onNavigate={setActiveTab}
        userName={name}
      />

      {waitlistModal && (
        <div className="modal-overlay" onClick={() => setWaitlistModal(null)}>
          <div className="modal-backdrop" />
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3 className="modal-title">Waiting Queue</h3>
                <p className="modal-subtitle">{waitlistModal.time} — {waitlistModal.date}</p>
              </div>
              <button className="modal-close" onClick={() => setWaitlistModal(null)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              {waitlistModal.users.length === 0 ? (
                <div className="modal-empty"><Inbox size={36} strokeWidth={1} /><p>No one is waiting for this slot.</p></div>
              ) : (
                <div className="modal-list">
                  {waitlistModal.users.map((w) => (
                    <div key={w.email || w.position} className="modal-user-row">
                      <div className="modal-user-rank">#{w.position}</div>
                      <div className="modal-user-avatar">{w.name?.charAt(0)}</div>
                      <div className="modal-user-info">
                        <div className="modal-user-name">{w.name}</div>
                        <div className="modal-user-email">{w.email}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {profileModal && (
        <div className="modal-overlay" onClick={() => setProfileModal(false)}>
          <div className="modal-backdrop" />
          <div className="modal profile-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">My Profile</h3>
              <button className="modal-close" onClick={() => setProfileModal(false)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <div className="profile-content">
                <div className="profile-avatar-large">
                  {user?.user?.name?.charAt(0)?.toUpperCase()}
                </div>
                <h2 className="profile-name">{user?.user?.name}</h2>
                <p className="profile-email">{user?.user?.email}</p>

                <div className="profile-details">
                  <div className="profile-detail-row">
                    <span className="profile-detail-label">Role</span>
                    <span className={`badge ${getRankBadgeClass(user?.user?.rank)}`}>
                      {user?.user?.roleName || 'Unassigned'}
                    </span>
                  </div>
                  <div className="profile-detail-row">
                    <span className="profile-detail-label">Access Level</span>
                    <span className={`badge ${getRankBadgeClass(user?.user?.rank)}`}>
                      {user?.user?.rank !== null && user?.user?.rank !== undefined ? `Level ${user.user.rank}` : 'Pending'}
                    </span>
                  </div>
                  <div className="profile-detail-row">
                    <span className="profile-detail-label">Status</span>
                    <span className={`badge ${profileData?.status === 'active' ? 'badge-emerald' : 'badge-gold'}`}>
                      {profileData?.status || 'Active'}
                    </span>
                  </div>
                  <div className="profile-detail-row">
                    <span className="profile-detail-label">Member Since</span>
                    <span className="profile-detail-value">
                      {profileData?.createdAt
                        ? new Date(profileData.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
                        : '—'}
                    </span>
                  </div>
                  <div className="profile-detail-row">
                    <span className="profile-detail-label">Last Updated</span>
                    <span className="profile-detail-value">
                      {profileData?.updatedAt
                        ? new Date(profileData.updatedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
                        : '—'}
                    </span>
                  </div>
                  <div className="profile-detail-row">
                    <span className="profile-detail-label">User ID</span>
                    <span className="profile-detail-value profile-id">{profileData?._id || user?.user?.id || '—'}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
