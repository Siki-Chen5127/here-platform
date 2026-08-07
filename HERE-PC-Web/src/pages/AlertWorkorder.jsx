import React, { useState, useEffect } from 'react';
import { ShieldAlert, CheckCircle2, AlertTriangle, PhoneCall, FileText, User, Loader2 } from 'lucide-react';
import { api } from '../services/api';

export default function AlertWorkorder() {
  const [orders, setOrders] = useState([]); // 存放从后端拿到的数据
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchOrders = () => {
    setIsLoading(true);
    api.get('/workorders')
      .then(res => {
        setOrders(res.data);
        if (res.data.length > 0) setSelectedOrder(res.data[0]);
        setIsLoading(false);
      })
      .catch(err => {
        console.error("无法获取工单数据", err);
        setIsLoading(false);
      });
  };

  useEffect(() => {
    let active = true;
    api.get('/workorders')
      .then((response) => {
        if (!active) return;
        setOrders(response.data);
        setSelectedOrder(response.data[0] || null);
      })
      .catch((error) => {
        console.error("无法获取工单数据", error);
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  // 处理工单的点击事件
  const handleResolve = (id) => {
    api.post(`/workorders/${id}/resolve`, { note: '' })
      .then(() => {
        alert("处理成功！");
        fetchOrders(); // 重新刷新列表
      });
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin mr-3" />
        正在从 FastAPI 加载实时预警工单...
      </div>
    );
  }

  return (
    <div className="flex h-full gap-6">
      {/* 左侧：工单列表区 */}
      <div className="w-1/3 flex flex-col h-full bg-white/80 backdrop-blur-xl border border-slate-100 rounded-3xl shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-50 shrink-0">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-rose-500" />
            待处理工单
          </h2>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {orders.map((order) => (
            <div 
              key={order.id}
              onClick={() => setSelectedOrder(order)}
              className={`p-4 rounded-2xl border transition-all cursor-pointer relative overflow-hidden ${selectedOrder?.id === order.id ? 'bg-slate-50 border-slate-300 shadow-md' : 'bg-white border-slate-100 hover:border-slate-200'}`}
            >
              <div className={`absolute top-0 left-0 w-1 h-full ${order.level === 'red' ? 'bg-rose-500' : 'bg-amber-400'}`}></div>
              <div className="flex justify-between items-start mb-2">
                <span className="font-bold text-slate-700 text-sm">{order.id}</span>
                {order.status === 'resolved' && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
              </div>
              <p className="text-xs text-slate-600 font-medium line-clamp-1">{order.summary}</p>
            </div>
          ))}
        </div>
      </div>

      {/* 右侧：工单详情 */}
      <div className="w-2/3 flex flex-col h-full bg-white/80 backdrop-blur-xl border border-slate-100 rounded-3xl shadow-sm overflow-hidden p-8 relative">
        {selectedOrder ? (
          <>
            {/* ... 详情展示代码同之前，但在处理按钮加上 onClick={handleResolve} ... */}
            <div className="mt-auto pt-6 flex gap-4">
               {selectedOrder.status !== 'resolved' && (
                 <button 
                   onClick={() => handleResolve(selectedOrder.id)}
                   className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white py-3 rounded-xl font-bold shadow-md shadow-emerald-200 transition-all flex justify-center items-center gap-2"
                 >
                   确认已线下转介闭环
                 </button>
               )}
            </div>
          </>
        ) : <p>请选择工单</p>}
      </div>
    </div>
  );
}
