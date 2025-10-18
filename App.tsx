

import React, { useState, useMemo, useEffect } from 'react';
import MonthlyComparisonChart from './components/MonthlyComparisonChart';
import DailyExpenseChart from './components/DailyExpenseChart';
import { Transaction, TransactionType, TransactionSource, MonthlyData, DailyData } from './types';

// --- CONFIGURATION ---
const TRANSACTIONS_STORAGE_KEY = 'financeTrackerTransactions';
const INITIAL_GENERAL_BALANCE_KEY = 'financeTrackerInitialGeneral';
const INITIAL_PROVISION_BALANCE_KEY = 'financeTrackerInitialProvision';
const MONTHLY_INCOME_GOAL_KEY = 'financeTrackerMonthlyIncomeGoal';


// Helper function to format currency in VND
const formatCurrency = (value: number) => 
    new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);

// Helper function to process raw transactions into monthly summary data for the chart
const processMonthlyData = (transactions: Transaction[]): MonthlyData[] => {
    const monthlySummary: { [key: string]: { income: number, expense: number } } = {};

    transactions.forEach(tx => {
        const month = tx.date.substring(0, 7); // "YYYY-MM"
        if (!monthlySummary[month]) {
            monthlySummary[month] = { income: 0, expense: 0 };
        }

        if (tx.type === TransactionType.INCOME) {
            monthlySummary[month].income += tx.amount;
        } else if (tx.type === TransactionType.EXPENSE) {
            monthlySummary[month].expense += tx.amount;
        }
    });

    return Object.keys(monthlySummary).map(month => ({
        month: month.substring(5, 7), // "MM" for chart label
        income: monthlySummary[month].income,
        expense: monthlySummary[month].expense,
    })).sort((a, b) => a.month.localeCompare(b.month));
};

// Helper function to process raw transactions into daily expense data for the chart
const processDailyData = (transactions: Transaction[], selectedMonth: string): DailyData[] => { // selectedMonth is "YYYY-MM"
    const dailySummary: { [key: string]: number } = {};

    transactions
        .filter(tx => tx.date.startsWith(selectedMonth) && tx.type === TransactionType.EXPENSE)
        .forEach(tx => {
            const day = tx.date.substring(8, 10); // "DD"
            if (!dailySummary[day]) {
                dailySummary[day] = 0;
            }
            dailySummary[day] += tx.amount;
        });
    
    return Object.keys(dailySummary).map(day => ({
        day: day,
        expense: dailySummary[day],
    })).sort((a, b) => a.day.localeCompare(b.day));
};

const App: React.FC = () => {
    const [transactions, setTransactions] = useState<Transaction[]>(() => {
        try {
            const storedTransactions = localStorage.getItem(TRANSACTIONS_STORAGE_KEY);
            return storedTransactions ? JSON.parse(storedTransactions) : [];
        } catch (e) {
            console.error("Failed to parse transactions from localStorage", e);
            return [];
        }
    });
    
    const [initialBalances, setInitialBalances] = useState(() => {
        try {
            const general = localStorage.getItem(INITIAL_GENERAL_BALANCE_KEY) || '0';
            const provision = localStorage.getItem(INITIAL_PROVISION_BALANCE_KEY) || '0';
            return { general, provision };
        } catch (e) {
            console.error("Failed to parse initial balances from localStorage", e);
            return { general: '0', provision: '0' };
        }
    });

    const [monthlyIncomeGoal, setMonthlyIncomeGoal] = useState(() => {
        try {
            return localStorage.getItem(MONTHLY_INCOME_GOAL_KEY) || '0';
        } catch (e) {
            console.error("Failed to parse income goal from localStorage", e);
            return '0';
        }
    });
    
    const [newTxData, setNewTxData] = useState({
        description: '',
        amount: '',
        date: new Date().toISOString().split('T')[0], // YYYY-MM-DD
        type: TransactionType.EXPENSE,
        source: TransactionSource.GENERAL,
        destination: TransactionSource.GENERAL,
    });

    useEffect(() => {
        try {
            localStorage.setItem(TRANSACTIONS_STORAGE_KEY, JSON.stringify(transactions));
        } catch (e) {
            console.error("Failed to save transactions to localStorage", e);
        }
    }, [transactions]);
    
    useEffect(() => {
        try {
            localStorage.setItem(INITIAL_GENERAL_BALANCE_KEY, initialBalances.general);
            localStorage.setItem(INITIAL_PROVISION_BALANCE_KEY, initialBalances.provision);
        } catch (e) {
            console.error("Failed to save initial balances to localStorage", e);
        }
    }, [initialBalances]);

     useEffect(() => {
        try {
            localStorage.setItem(MONTHLY_INCOME_GOAL_KEY, monthlyIncomeGoal);
        } catch (e) {
            console.error("Failed to save income goal to localStorage", e);
        }
    }, [monthlyIncomeGoal]);
    
    const handleAddTransaction = (e: React.FormEvent) => {
        e.preventDefault();
        const amount = parseFloat(newTxData.amount);
        if (!newTxData.description.trim() || isNaN(amount) || amount <= 0) {
            alert("Vui lòng điền đầy đủ và chính xác các thông tin.");
            return;
        }

        if (newTxData.type === TransactionType.TRANSFER && newTxData.source === newTxData.destination) {
            alert("Nguồn và đích không được giống nhau khi thực hiện chuyển khoản.");
            return;
        }

        const newTransaction: Omit<Transaction, 'rowIndex'> = {
            id: `txn-${new Date().getTime()}`,
            date: new Date(newTxData.date).toISOString(),
            description: newTxData.description.trim(),
            amount: amount,
            type: newTxData.type,
            source: newTxData.source,
            destination: newTxData.type === TransactionType.TRANSFER ? newTxData.destination : undefined,
        };

        const updatedTransactions = [newTransaction as Transaction, ...transactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setTransactions(updatedTransactions);

        // Reset form
        setNewTxData({
            description: '',
            amount: '',
            date: new Date().toISOString().split('T')[0],
            type: TransactionType.EXPENSE,
            source: TransactionSource.GENERAL,
            destination: TransactionSource.GENERAL,
        });
    };
    
    const handleNewTxChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setNewTxData(prev => ({ ...prev, [name]: value }));
    };
    
    const handleInitialBalanceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setInitialBalances(prev => ({ ...prev, [name]: value }));
    };

    const handleIncomeGoalChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setMonthlyIncomeGoal(e.target.value);
    };

    const handleDeleteTransaction = (txIdToDelete: string) => {
        if (window.confirm(`Bạn có chắc muốn xóa giao dịch này không?`)) {
            setTransactions(prev => prev.filter(tx => tx.id !== txIdToDelete));
        }
    };
    
    const handleClearAllData = () => {
        if (window.confirm('Bạn có chắc chắn muốn xóa toàn bộ dữ liệu không? Hành động này không thể hoàn tác.')) {
            localStorage.clear();
            window.location.reload();
        }
    };
    
    // --- Memoized calculations for UI ---
    const balances = useMemo(() => {
        const initialGeneral = parseFloat(initialBalances.general) || 0;
        const initialProvision = parseFloat(initialBalances.provision) || 0;

        let general = initialGeneral;
        let provision = initialProvision;

        transactions.forEach(tx => {
            switch (tx.type) {
                case TransactionType.INCOME:
                    if (tx.source === TransactionSource.GENERAL) {
                        general += tx.amount;
                    } else if (tx.source === TransactionSource.PROVISION) {
                        provision += tx.amount;
                    }
                    break;
                case TransactionType.EXPENSE:
                    if (tx.source === TransactionSource.GENERAL) {
                        general -= tx.amount;
                    } else if (tx.source === TransactionSource.PROVISION) {
                        provision -= tx.amount;
                    }
                    break;
                case TransactionType.TRANSFER:
                    if (tx.source === TransactionSource.GENERAL && tx.destination === TransactionSource.PROVISION) {
                        general -= tx.amount;
                        provision += tx.amount;
                    } else if (tx.source === TransactionSource.PROVISION && tx.destination === TransactionSource.GENERAL) {
                        provision -= tx.amount;
                        general += tx.amount;
                    }
                    break;
            }
        });

        return { general, provision };
    }, [transactions, initialBalances]);

    const currentMonthStats = useMemo(() => {
        const goal = parseFloat(monthlyIncomeGoal) || 0;

        const currentMonthStr = new Date().toISOString().substring(0, 7); // "YYYY-MM"
        
        const currentMonthTransactions = transactions.filter(tx => tx.date.startsWith(currentMonthStr));

        const spent = currentMonthTransactions
            .filter(tx => tx.type === TransactionType.EXPENSE)
            .reduce((sum, tx) => sum + tx.amount, 0);

        const transferOutFromGeneral = currentMonthTransactions
            .filter(tx => tx.type === TransactionType.TRANSFER && tx.source === TransactionSource.GENERAL)
            .reduce((sum, tx) => sum + tx.amount, 0);
            
        const totalUsed = spent + transferOutFromGeneral;

        const remaining = goal > 0 ? goal - totalUsed : 0;
        const progress = goal > 0 ? (totalUsed / goal) * 100 : 0;

        return { remaining, totalUsed, progress: Math.min(progress, 100) }; // Cap progress at 100%
    }, [transactions, monthlyIncomeGoal]);
    
    const uniqueMonths = useMemo(() => {
        const months = new Set(transactions.map(tx => tx.date.substring(0, 7)));
        return Array.from(months).sort().reverse();
    }, [transactions]);
    
    const [selectedMonth, setSelectedMonth] = useState<string>('');

    useEffect(() => {
        // Update selectedMonth if it becomes invalid or on initial load
        if (uniqueMonths.length > 0) {
            if (!selectedMonth || !uniqueMonths.includes(selectedMonth)) {
                setSelectedMonth(uniqueMonths[0]);
            }
        } else {
             setSelectedMonth('');
        }
    }, [uniqueMonths, selectedMonth]);

    const monthlyData = useMemo(() => processMonthlyData(transactions), [transactions]);
    const dailyData = useMemo(() => selectedMonth ? processDailyData(transactions, selectedMonth) : [], [transactions, selectedMonth]);

    const selectedMonthSummary = useMemo(() => {
        if (!selectedMonth) return { income: 0, expense: 0, transferOut: 0, remaining: 0 };

        const summary = { income: 0, expense: 0, transferOut: 0 };

        transactions
            .filter(tx => tx.date.startsWith(selectedMonth))
            .forEach(tx => {
                if (tx.type === TransactionType.INCOME) {
                    summary.income += tx.amount;
                } else if (tx.type === TransactionType.EXPENSE) {
                    summary.expense += tx.amount;
                } else if (tx.type === TransactionType.TRANSFER && tx.source === TransactionSource.GENERAL) {
                    summary.transferOut += tx.amount;
                }
            });
        
        const remaining = summary.income - summary.expense - summary.transferOut;

        return { ...summary, remaining };
    }, [transactions, selectedMonth]);

    return (
        <div className="bg-primary text-text-primary min-h-screen font-sans flex flex-col">
            <header className="bg-secondary p-4 shadow-md flex justify-between items-center sticky top-0 z-10">
                <h1 className="text-2xl font-bold text-highlight">
                    <i className="fas fa-wallet mr-2"></i>
                    Personal Finance Tracker
                </h1>
            </header>

            <main className="p-4 md:p-8 grid grid-cols-1 lg:grid-cols-3 gap-8 flex-grow">
                <div className="lg:col-span-2 space-y-8">
                    <div className="bg-secondary p-6 rounded-lg shadow-lg">
                         <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-semibold text-text-secondary">Thiết lập số dư & Thu nhập</h3>
                            <button 
                                onClick={handleClearAllData}
                                className="bg-red-600 hover:bg-red-700 text-white text-sm font-bold py-1 px-3 rounded-md transition duration-300"
                                title="Xóa toàn bộ dữ liệu"
                            >
                                <i className="fas fa-trash-alt mr-2"></i>Xóa Dữ Liệu
                            </button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label htmlFor="general" className="block text-sm font-medium text-text-secondary mb-1">Số dư chính</label>
                                <input
                                    type="number"
                                    name="general"
                                    id="general"
                                    value={initialBalances.general}
                                    onChange={handleInitialBalanceChange}
                                    placeholder="0"
                                    className="w-full bg-primary border border-accent rounded-md p-2 text-text-primary focus:outline-none focus:ring-2 focus:ring-highlight"
                                />
                            </div>
                            <div>
                                <label htmlFor="provision" className="block text-sm font-medium text-text-secondary mb-1">Quỹ dự phòng</label>
                                <input
                                    type="number"
                                    name="provision"
                                    id="provision"
                                    value={initialBalances.provision}
                                    onChange={handleInitialBalanceChange}
                                    placeholder="0"
                                    className="w-full bg-primary border border-accent rounded-md p-2 text-text-primary focus:outline-none focus:ring-2 focus:ring-highlight"
                                />
                            </div>
                        </div>
                        <div className="mt-4">
                            <label htmlFor="incomeGoal" className="block text-sm font-medium text-text-secondary mb-1">Thiết lập thu nhập hàng tháng</label>
                            <input
                                type="number"
                                name="incomeGoal"
                                id="incomeGoal"
                                value={monthlyIncomeGoal}
                                onChange={handleIncomeGoalChange}
                                placeholder="0"
                                className="w-full bg-primary border border-accent rounded-md p-2 text-text-primary focus:outline-none focus:ring-2 focus:ring-highlight"
                            />
                        </div>
                    </div>
                
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-secondary p-6 rounded-lg shadow-lg">
                            <h3 className="text-lg font-semibold text-text-secondary mb-2">Số dư chính</h3>
                            <p className="text-3xl font-bold text-green-400">{formatCurrency(balances.general)}</p>
                        </div>
                        <div className="bg-secondary p-6 rounded-lg shadow-lg">
                            <h3 className="text-lg font-semibold text-text-secondary mb-2">Số dư quỹ dự phòng</h3>
                            <p className="text-3xl font-bold text-yellow-400">{formatCurrency(balances.provision)}</p>
                        </div>
                         <div className="bg-secondary p-6 rounded-lg shadow-lg">
                            <h3 className="text-lg font-semibold text-text-secondary mb-2">Thu nhập còn lại (tháng này)</h3>
                            <p className={`text-3xl font-bold ${currentMonthStats.remaining >= 0 ? 'text-blue-400' : 'text-red-500'}`}>
                                {formatCurrency(currentMonthStats.remaining)}
                            </p>
                             <div className="mt-4">
                                <div className="w-full bg-primary rounded-full h-2.5">
                                    <div 
                                        className={`h-2.5 rounded-full ${
                                            currentMonthStats.progress > 85 ? 'bg-red-500' :
                                            currentMonthStats.progress > 60 ? 'bg-yellow-500' :
                                            'bg-highlight'
                                        }`} 
                                        style={{ width: `${currentMonthStats.progress}%` }}
                                        aria-valuenow={currentMonthStats.progress}
                                        aria-valuemin={0}
                                        aria-valuemax={100}
                                        role="progressbar"
                                    ></div>
                                </div>
                                <div className="flex justify-between text-sm text-text-secondary mt-1">
                                    <span>Đã dùng: {formatCurrency(currentMonthStats.totalUsed)}</span>
                                    <span>Mục tiêu: {formatCurrency(parseFloat(monthlyIncomeGoal) || 0)}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                     {selectedMonth && (
                        <div className="bg-secondary p-6 rounded-lg shadow-lg">
                            <h3 className="text-lg font-semibold text-text-secondary mb-4">Dòng tiền tháng {selectedMonth.substring(5, 7)}/{selectedMonth.substring(0, 4)}</h3>
                            <div className="space-y-3">
                                <div className="flex justify-between items-center">
                                    <p className="text-text-primary">Thu nhập:</p>
                                    <p className="font-bold text-green-400">(+) {formatCurrency(selectedMonthSummary.income)}</p>
                                </div>
                                <div className="flex justify-between items-center">
                                    <p className="text-text-primary">Chi tiêu:</p>
                                    <p className="font-bold text-red-400">(-) {formatCurrency(selectedMonthSummary.expense)}</p>
                                </div>
                                 <div className="flex justify-between items-center">
                                    <p className="text-text-primary">Chuyển khoản đi (Nguồn chính):</p>
                                    <p className="font-bold text-yellow-400">(-) {formatCurrency(selectedMonthSummary.transferOut)}</p>
                                </div>
                                <hr className="border-accent my-2" />
                                <div className="flex justify-between items-center">
                                    <p className="text-xl font-bold text-text-primary">Còn lại:</p>
                                    <p className={`text-2xl font-bold ${selectedMonthSummary.remaining >= 0 ? 'text-highlight' : 'text-red-500'}`}>
                                        {formatCurrency(selectedMonthSummary.remaining)}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                    
                    <MonthlyComparisonChart data={monthlyData} />
                    
                    <div className="bg-secondary p-6 rounded-lg shadow-lg">
                         <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-bold text-text-primary">Chi tiêu hàng ngày</h3>
                             <select
                                value={selectedMonth}
                                onChange={(e) => setSelectedMonth(e.target.value)}
                                className="bg-primary border border-accent rounded-md p-2 text-text-primary focus:outline-none focus:ring-2 focus:ring-highlight"
                                disabled={uniqueMonths.length === 0}
                            >
                                {uniqueMonths.map(month => (
                                    <option key={month} value={month}>{month}</option>
                                ))}
                            </select>
                        </div>
                        <DailyExpenseChart data={dailyData} month={selectedMonth ? selectedMonth.substring(5, 7) : ''} />
                    </div>
                </div>

                <aside className="lg:col-span-1 bg-secondary p-6 rounded-lg shadow-lg">
                    {/* Add Transaction Form */}
                    <div className="mb-6">
                        <h3 className="text-xl font-bold mb-4 text-text-primary">Thêm giao dịch mới</h3>
                        <form onSubmit={handleAddTransaction} className="space-y-3">
                            <input type="text" name="description" value={newTxData.description} onChange={handleNewTxChange} placeholder="Mô tả" className="w-full bg-primary border border-accent rounded-md p-2 text-text-primary focus:outline-none focus:ring-2 focus:ring-highlight" required />
                            <input type="number" name="amount" value={newTxData.amount} onChange={handleNewTxChange} placeholder="Số tiền" className="w-full bg-primary border border-accent rounded-md p-2 text-text-primary focus:outline-none focus:ring-2 focus:ring-highlight" required />
                            <input type="date" name="date" value={newTxData.date} onChange={handleNewTxChange} className="w-full bg-primary border border-accent rounded-md p-2 text-text-primary focus:outline-none focus:ring-2 focus:ring-highlight" required />
                            <select name="type" value={newTxData.type} onChange={handleNewTxChange} className="w-full bg-primary border border-accent rounded-md p-2 text-text-primary focus:outline-none focus:ring-2 focus:ring-highlight">
                                <option value={TransactionType.EXPENSE}>Chi tiêu</option>
                                <option value={TransactionType.INCOME}>Thu nhập</option>
                                <option value={TransactionType.TRANSFER}>Chuyển khoản</option>
                            </select>
                            <select name="source" value={newTxData.source} onChange={handleNewTxChange} className="w-full bg-primary border border-accent rounded-md p-2 text-text-primary focus:outline-none focus:ring-2 focus:ring-highlight">
                                <option value={TransactionSource.GENERAL}>Nguồn chính</option>
                                <option value={TransactionSource.PROVISION}>Quỹ dự phòng</option>
                            </select>
                            {newTxData.type === TransactionType.TRANSFER && (
                                <select name="destination" value={newTxData.destination} onChange={handleNewTxChange} className="w-full bg-primary border border-accent rounded-md p-2 text-text-primary focus:outline-none focus:ring-2 focus:ring-highlight">
                                    <option value={TransactionSource.GENERAL}>Nguồn chính</option>
                                    <option value={TransactionSource.PROVISION}>Quỹ dự phòng</option>
                                </select>
                            )}
                            <button type="submit" className="w-full bg-highlight text-primary font-bold py-2 px-4 rounded-md hover:bg-teal-400 transition duration-300">
                                Thêm
                            </button>
                        </form>
                    </div>

                    <h3 className="text-xl font-bold mb-4 text-text-primary">Giao dịch gần đây</h3>
                    <div className="space-y-4 overflow-y-auto max-h-[calc(100vh-450px)]">
                        {transactions.slice(0, 20).map(tx => (
                            <div key={tx.id} className="flex justify-between items-center p-3 bg-primary rounded-md group">
                                <div className="flex-grow">
                                    <p className="font-semibold">{tx.description}</p>
                                    <p className="text-sm text-text-secondary">
                                        {new Date(tx.date).toLocaleDateString('vi-VN')}
                                        <span className="mx-2">·</span>
                                        <span className={`${
                                            tx.type === TransactionType.INCOME ? 'text-green-400' :
                                            tx.type === TransactionType.EXPENSE ? 'text-red-400' :
                                            'text-yellow-400'
                                        }`}>
                                            {
                                                tx.type === TransactionType.INCOME ? 'Thu nhập' :
                                                tx.type === TransactionType.EXPENSE ? 'Chi tiêu' :
                                                'Chuyển khoản'
                                            }
                                        </span>
                                    </p>
                                </div>
                                <p className={`font-bold mr-4 ${
                                    tx.type === TransactionType.INCOME ? 'text-green-400' :
                                    tx.type === TransactionType.EXPENSE ? 'text-red-400' :
                                    'text-yellow-400'
                                }`}>
                                    {tx.type === TransactionType.INCOME ? '+' : tx.type === TransactionType.EXPENSE ? '-' : ''}{formatCurrency(tx.amount)}
                                </p>
                                <button onClick={() => handleDeleteTransaction(tx.id)} className="text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <i className="fas fa-trash"></i>
                                </button>
                            </div>
                        ))}
                         {transactions.length === 0 && (
                            <p className="text-text-secondary text-center mt-8">Không có giao dịch nào.</p>
                        )}
                    </div>
                </aside>
            </main>
            <footer className="bg-secondary text-center p-4 mt-auto">
                <p className="text-text-secondary text-sm">
                    Developed by <a href="https://hoangtr.com.vn" target="_blank" rel="noopener noreferrer" className="text-highlight hover:underline">Hoang Tran</a>.
                </p>
                <p className="text-text-secondary text-sm mt-1">
                    Support: <a href="mailto:huytrannguyen962@gmail.com" className="text-highlight hover:underline">huytrannguyen962@gmail.com</a>
                </p>
            </footer>
        </div>
    );
};

export default App;