import React, { useState, useEffect } from 'react';
import { 
  Activity, ShieldAlert, Users, HeartPulse, 
  Map, LayoutDashboard, Settings, Bell, 
  RefreshCw, AlertCircle, PhoneCall, FileText, 
  User, CheckCircle2, AlertTriangle, Loader2, 
  Lock, Mail, ArrowRight, LogOut, Search, Filter,
  Database
} from 'lucide-react';

// 导入我们单独抽离的图谱规章管理页面
import KnowledgeGraphView from './pages/KnowledgeGraphView';
import { api, authApi, sessionStore } from './services/api';

// ==========================================
// 1. 登录页面组件
// ==========================================
const LoginView = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setErrorMsg('');
    try {
      const session = await authApi.login(email, password);
      onLogin(session.user);
    } catch (error) {
      setErrorMsg(error.response?.data?.detail || "网络错误，请确保后端已启动");
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-50 relative overflow-hidden">
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-400/20 rounded-full blur-[120px] mix-blend-multiply"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-400/20 rounded-full blur-[120px] mix-blend-multiply"></div>
      <div className="m-auto w-full max-w-md relative z-10">
        <div className="bg-white/80 backdrop-blur-xl p-10 rounded-[2rem] shadow-2xl border border-white">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-3xl mx-auto flex items-center justify-center shadow-lg mb-6"><HeartPulse className="w-8 h-8 text-white" /></div>
            <h1 className="text-2xl font-black text-slate-800">HERE 治理控制台</h1>
            <p className="text-sm text-slate-500 mt-2">校园心理健康全链路守护系统</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-5">
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="测试账号: admin@here.edu" className="w-full bg-slate-50 border border-slate-200 px-12 py-3.5 rounded-xl outline-none focus:border-emerald-500" required />
            </div>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="开发密码: ChangeMe123!" className="w-full bg-slate-50 border border-slate-200 px-12 py-3.5 rounded-xl outline-none focus:border-emerald-500" required />
            </div>
            {errorMsg && <p className="text-rose-500 text-sm font-bold text-center bg-rose-50 p-2 rounded-lg">{errorMsg}</p>}
            <button type="submit" disabled={isLoggingIn} className="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-colors">
              {isLoggingIn ? <Loader2 className="w-5 h-5 animate-spin" /> : <>进入控制台 <ArrowRight className="w-4 h-4" /></>}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

// ==========================================
// 2. 统计卡片与动态热力聚类组件
// ==========================================
const StatCard = ({ title, value, icon, unit, colorClass }) => (
  <div className="bg-white/80 p-6 rounded-3xl border border-slate-100 shadow-sm relative overflow-hidden group">
    <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${colorClass} opacity-5 rounded-full -mr-10 -mt-10`}></div>
    <div className="flex justify-between items-start mb-4 relative z-10"><div className="p-3 bg-slate-50 rounded-2xl text-slate-600">{React.createElement(icon, { size: 24 })}</div></div>
    <div className="relative z-10"><h3 className="text-slate-500 text-sm font-medium mb-1">{title}</h3><div className="flex items-baseline gap-2"><span className="text-3xl font-bold text-slate-800">{value}</span>{unit && <span className="text-sm text-slate-400">{unit}</span>}</div></div>
  </div>
);

const EmotionCluster = ({ data }) => {
  const [isHovered, setIsHovered] = useState(false);
  const colorMap = {
    orange: 'from-orange-400 to-amber-500 shadow-orange-200 text-orange-600 bg-orange-50 border-orange-100',
    indigo: 'from-indigo-400 to-blue-500 shadow-indigo-200 text-indigo-600 bg-indigo-50 border-indigo-100',
    teal: 'from-teal-400 to-emerald-500 shadow-teal-200 text-teal-600 bg-teal-50 border-teal-100',
    pink: 'from-pink-400 to-rose-500 shadow-pink-200 text-pink-600 bg-pink-50 border-pink-100'
  };
  const colors = colorMap[data.color]?.split(' ') || colorMap.orange.split(' ');

  return (
    <div className="absolute transform -translate-x-1/2 -translate-y-1/2 transition-all duration-700 ease-out cursor-pointer" style={{ left: `${data.x}%`, top: `${data.y}%`, zIndex: isHovered ? 50 : 10 }} onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)}>
      <div className={`absolute inset-0 bg-gradient-to-br ${colors[0]} ${colors[1]} rounded-full opacity-10 blur-2xl`} style={{ width: `${data.size}px`, height: `${data.size}px`, transform: `translate(-50%, -50%) scale(${isHovered ? 1.2 : 1})`, animation: isHovered ? 'none' : 'pulse 3s infinite alternate' }}></div>
      <div className={`relative bg-white/95 backdrop-blur-md border ${colors[5]} p-5 rounded-3xl shadow-xl w-64 ${isHovered ? 'scale-105 shadow-2xl' : 'scale-100'}`}>
        <div className="flex items-center gap-2 mb-3"><div className={`w-3 h-3 rounded-full bg-gradient-to-br ${colors[0]} ${colors[1]} ${colors[2]}`}></div><span className="font-bold text-slate-800 text-lg">{data.name}</span></div>
        <div className="space-y-2 mb-4 text-sm">
          <div className="flex justify-between"><span className="text-slate-500">涉众规模</span><span className="font-bold text-slate-700">{data.value} 人次</span></div>
          <div className="flex justify-between"><span className="text-slate-500">共性节点</span><span className="font-medium text-slate-600 truncate max-w-[100px]">{data.related}</span></div>
        </div>
      </div>
    </div>
  );
};

// ==========================================
// 3. 工单页面与档案页面组件 (精简嵌入)
// ==========================================
const WorkorderView = () => {
  const [orders, setOrders] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchOrders = () => {
    setIsLoading(true);
    api.get('/workorders')
      .then(res => { setOrders(res.data); if (res.data.length > 0) setSelectedOrder(res.data[0]); setIsLoading(false); })
      .catch(() => setIsLoading(false));
  };
  useEffect(() => {
    let active = true;
    api.get('/workorders')
      .then((response) => {
        if (!active) return;
        setOrders(response.data);
        setSelectedOrder(response.data[0] || null);
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);
  const handleResolve = (id) => { api.post(`/workorders/${id}/resolve`, { note: '' }).then(() => fetchOrders()); };

  if (isLoading) return <div className="flex h-full items-center justify-center text-slate-400"><Loader2 className="animate-spin mr-3"/>加载真实数据库工单中...</div>;

  return (
    <div className="flex h-full gap-6">
      <div className="w-1/3 flex flex-col bg-white/80 border border-slate-100 rounded-3xl overflow-hidden shadow-sm">
        <div className="p-6 border-b border-slate-50"><h2 className="text-lg font-bold text-slate-800">待处理工单</h2></div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {orders.map((order) => (
            <div key={order.id} onClick={() => setSelectedOrder(order)} className={`p-4 rounded-2xl border cursor-pointer relative overflow-hidden ${selectedOrder?.id === order.id ? 'bg-slate-50 border-slate-300 shadow-md' : 'bg-white border-slate-100'}`}>
              <div className={`absolute top-0 left-0 w-1 h-full ${order.level === 'red' ? 'bg-rose-500' : 'bg-amber-400'}`}></div>
              <div className="flex justify-between items-start mb-2"><span className="font-bold text-slate-700">{order.id}</span>{order.status === 'resolved' && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}</div>
              <p className="text-xs text-slate-600 line-clamp-1">{order.summary}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="w-2/3 flex flex-col bg-white/80 border border-slate-100 rounded-3xl p-8 shadow-sm">
        {selectedOrder && (
          <>
            <div className="mb-6 border-b border-slate-100 pb-6"><h2 className="text-2xl font-bold text-slate-800">工单详情 {selectedOrder.id}</h2><p className="text-sm text-slate-500 mt-2 flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> 报警源：{selectedOrder.source}</p></div>
            <div className="space-y-6 flex-1">
              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 flex items-start gap-4"><div className="w-12 h-12 bg-indigo-100 text-indigo-500 rounded-full flex items-center justify-center"><User /></div><div><h3 className="font-bold text-slate-800">涉事学生档案</h3><p className="text-sm text-slate-600">{selectedOrder.student}</p></div></div>
              <div><h3 className="font-bold text-slate-800 mb-2">AI 调度引擎溯源</h3><div className="bg-rose-50/50 p-5 rounded-2xl border border-rose-100 text-sm text-slate-700">{selectedOrder.details}</div></div>
            </div>
            <div className="mt-auto pt-6 flex gap-4">
              {selectedOrder.status !== 'resolved' ? (
                <button onClick={() => handleResolve(selectedOrder.id)} className="flex-1 bg-emerald-500 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2"><CheckCircle2 className="w-5 h-5" /> 确认已线下转介闭环</button>
              ) : <div className="flex-1 bg-slate-100 text-slate-500 py-3 rounded-xl font-bold flex justify-center items-center">此工单已处理完毕</div>}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

const ArchiveView = () => (
  <div className="bg-white/80 border border-slate-100 rounded-3xl shadow-sm overflow-hidden flex flex-col h-full">
    <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-white">
      <div><h2 className="text-2xl font-bold text-slate-800">干预档案中心</h2><p className="text-sm text-slate-500 mt-1">查看已闭环的辅导记录</p></div>
    </div>
    <div className="p-8 flex-1 overflow-y-auto">
      <h3 className="text-sm font-bold text-slate-800 mb-4 uppercase">最近归档</h3>
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
            <div className="flex items-center gap-4"><div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center"><CheckCircle2 className="w-5 h-5" /></div><div><p className="font-bold text-slate-800 text-sm">工单 #C-098{i} 已完成闭环</p><p className="text-xs text-slate-500 font-medium">辅导员面谈记录已同步</p></div></div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

// ==========================================
// 4. 控制台主入口
// ==========================================
export default function App() {
  const [currentUser, setCurrentUser] = useState(() => sessionStore.getUser()); 
  const [currentView, setCurrentView] = useState('heatmap'); 
  const timeRange = '7days';
  const [data, setData] = useState(null);

  useEffect(() => {
    const handleUnauthorized = () => setCurrentUser(null);
    window.addEventListener('here:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('here:unauthorized', handleUnauthorized);
  }, []);

  useEffect(() => {
    if (currentUser && currentView === 'heatmap') {
      api.get(`/dashboard?range=${timeRange}`)
        .then(res => setData(res.data))
        .catch(() => setData(null)); 
    }
  }, [timeRange, currentView, currentUser]);

  if (!currentUser) return <LoginView onLogin={(user) => setCurrentUser(user)} />;

  const handleLogout = () => {
    sessionStore.clear();
    setCurrentUser(null);
  };

  return (
    <div className="flex h-screen bg-[#f4f7f6] font-sans overflow-hidden">
      <aside className="w-[280px] bg-white border-r border-slate-100 flex flex-col shrink-0 z-20">
        <div className="h-24 flex items-center px-8 border-b border-slate-50">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center mr-4"><HeartPulse className="text-white w-6 h-6" /></div>
          <div><h1 className="text-xl font-black text-slate-800">HERE</h1><p className="text-[10px] font-bold text-slate-400">AI 协同治理</p></div>
        </div>

        <nav className="flex-1 py-8 px-6 space-y-3">
          <button onClick={() => setCurrentView('heatmap')} className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl font-bold ${currentView === 'heatmap' ? 'bg-emerald-50 text-emerald-700' : 'text-slate-500 hover:bg-slate-50'}`}><Map className="w-5 h-5" /> 宏观情绪热力图</button>
          <button onClick={() => setCurrentView('workorder')} className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl font-bold ${currentView === 'workorder' ? 'bg-emerald-50 text-emerald-700' : 'text-slate-500 hover:bg-slate-50'}`}><ShieldAlert className="w-5 h-5" /> 三级预警流转</button>
          
          <button onClick={() => setCurrentView('knowledge')} className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl font-bold transition-all ${currentView === 'knowledge' ? 'bg-indigo-50 text-indigo-700 border border-indigo-100 shadow-sm shadow-indigo-100/50' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800 border border-transparent'}`}>
            <Database className="w-5 h-5" /> 图谱规章管理
          </button>
          
          <button onClick={() => setCurrentView('archive')} className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl font-bold ${currentView === 'archive' ? 'bg-emerald-50 text-emerald-700' : 'text-slate-500 hover:bg-slate-50'}`}><LayoutDashboard className="w-5 h-5" /> 干预档案中心</button>
        </nav>

        <div className="p-6 border-t border-slate-50">
          <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl cursor-pointer hover:bg-slate-100 group relative">
            <div className="w-10 h-10 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold">{currentUser?.name?.[0] || 'A'}</div>
            <div className="flex flex-col"><span className="text-sm font-bold text-slate-700">{currentUser?.name || '管理员'}</span><span className="text-[11px] font-semibold text-slate-400">{currentUser?.role || 'Admin'}</span></div>
            <button onClick={handleLogout} className="absolute right-4 text-slate-400 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity" aria-label="退出登录"><LogOut className="w-5 h-5" /></button>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col h-full overflow-hidden">
        <header className="h-24 bg-white/80 backdrop-blur-xl border-b border-slate-100 flex items-center justify-between px-10 shrink-0 z-10 sticky top-0">
          <h2 className="text-2xl font-bold text-slate-800">
            {currentView === 'heatmap' ? '全域心理状态大屏' : 
             currentView === 'workorder' ? '预警协同中心' : 
             currentView === 'knowledge' ? '规章与知识图谱中枢' :
             '历史档案记录'}
          </h2>
        </header>

        <div className="flex-1 overflow-y-auto p-10 flex flex-col gap-8">
          {currentView === 'heatmap' && (
             <>
               <div className="grid grid-cols-4 gap-6 shrink-0">
                 <StatCard title="活跃守护终端" value={data?.metrics?.activeUsers || 0} icon={Users} colorClass="from-blue-400 to-indigo-500" />
                 <StatCard title="主动干预会话" value={data?.metrics?.interventions || 0} icon={Activity} unit="次" colorClass="from-emerald-400 to-teal-500" />
                 <StatCard title="需关注高危意图" value={data?.metrics?.alerts || 0} icon={AlertCircle} unit="件" colorClass="from-rose-400 to-red-500" />
                 <StatCard title="校园情绪健康度" value={data?.metrics?.healthScore || 0} icon={HeartPulse} unit="/ 100" colorClass="from-amber-400 to-orange-500" />
               </div>
               <div className="flex-1 bg-white/80 border border-slate-100 rounded-[2rem] shadow-sm flex flex-col relative min-h-[600px] overflow-hidden">
                 <div className="p-8 border-b border-slate-50 z-20 bg-white"><h3 className="font-black text-slate-800 text-xl">全局压力源语义拓扑分布</h3></div>
                 <div className="flex-1 relative bg-[#fafcfb] overflow-hidden">
                   {data?.clusters?.map(cluster => <EmotionCluster key={`${timeRange}-${cluster.id}`} data={cluster} />)}
                 </div>
               </div>
             </>
          )}
          {currentView === 'workorder' && <WorkorderView />}
          {currentView === 'knowledge' && <KnowledgeGraphView />}
          {currentView === 'archive' && <ArchiveView />}
        </div>
      </main>
    </div>
  );
}
