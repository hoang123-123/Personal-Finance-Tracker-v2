import React, { useState, useMemo, useEffect } from 'react';
import MonthlyComparisonChart from './components/MonthlyComparisonChart';
import DailyExpenseChart from './components/DailyExpenseChart';
import { Transaction, TransactionType, TransactionSource, MonthlyData, DailyData } from './types';
import { initialTransactions } from './data';

// --- CONFIGURATION ---
const TRANSACTIONS_STORAGE_KEY = 'financeTrackerTransactions';

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
            return storedTransactions ? JSON.parse(storedTransactions) : initialTransactions;
        } catch (e) {
            console.error("Failed to parse transactions from localStorage", e);
            return initialTransactions;
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
    
    const handleAddTransaction = (e: React.FormEvent) => {
        e.preventDefault();
        const amount = parseFloat(newTxData.amount);
        if (!newTxData.description.trim() || isNaN(amount) || amount <= 0) {
            alert("Vui lòng điền đầy đủ và chính xác các thông tin.");
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

    const handleDeleteTransaction = (txIdToDelete: string) => {
        if (window.confirm(`Bạn có chắc muốn xóa giao dịch này không?`)) {
            setTransactions(prev => prev.filter(tx => tx.id !== txIdToDelete));
        }
    };
    
    // --- Memoized calculations for UI ---
    const balances = useMemo(() => {
        let totalIncome = 0;
        let totalExpense = 0;
        let provisionBalance = 0;

        transactions.forEach(tx => {
            if (tx.type === TransactionType.INCOME) {
                totalIncome += tx.amount;
            } else if (tx.type === TransactionType.EXPENSE) {
                totalExpense += tx.amount;
                if (tx.source === TransactionSource.PROVISION) {
                    provisionBalance -= tx.amount;
                }
            } else if (tx.type === TransactionType.TRANSFER && tx.destination === TransactionSource.PROVISION) {
                 provisionBalance += tx.amount;
            }
        });
        
        const totalBalance = totalIncome - totalExpense;
        const generalBalance = totalBalance - provisionBalance;

        return { general: generalBalance, provision: provisionBalance };
    }, [transactions]);
    
    const uniqueMonths = useMemo(() => {
        const months = new Set(transactions.map(tx => tx.date.substring(0, 7)));
        return Array.from(months).sort().reverse();
    }, [transactions]);
    
    const [selectedMonth, setSelectedMonth] = useState<string>('');

    useEffect(() => {
        if (uniqueMonths.length > 0 && !selectedMonth) {
            setSelectedMonth(uniqueMonths[0]);
        }
    }, [uniqueMonths, selectedMonth]);

    const monthlyData = useMemo(() => processMonthlyData(transactions), [transactions]);
    const dailyData = useMemo(() => selectedMonth ? processDailyData(transactions, selectedMonth) : [], [transactions, selectedMonth]);

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
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-secondary p-6 rounded-lg shadow-lg">
                            <h3 className="text-lg font-semibold text-text-secondary mb-2">Số dư chính</h3>
                            <p className="text-3xl font-bold text-green-400">{formatCurrency(balances.general)}</p>
                        </div>
                        <div className="bg-secondary p-6 rounded-lg shadow-lg">
                            <h3 className="text-lg font-semibold text-text-secondary mb-2">Số dư quỹ dự phòng</h3>
                            <p className="text-3xl font-bold text-yellow-400">{formatCurrency(balances.provision)}</p>
                        </div>
                    </div>
                    
                    <MonthlyComparisonChart data={monthlyData} />
                    
                    <div className="bg-secondary p-6 rounded-lg shadow-lg">
                         <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-bold text-text-primary">Chi tiêu hàng ngày</h3>
                             <select
                                value={selectedMonth}
                                onChange={(e) => setSelectedMonth(e.target.value)}
                                className="bg-primary border border-accent rounded-md p-2 text-text-primary focus:outline-none focus:ring-2 focus:ring-highlight"
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
                                    <p className="text-sm text-text-secondary">{new Date(tx.date).toLocaleDateString('vi-VN')}</p>
                                </div>
                                <p className={`font-bold mr-4 ${
                                    tx.type === TransactionType.INCOME ? 'text-green-400' :
                                    tx.type === TransactionType.EXPENSE ? 'text-red-400' :
                                    'text-yellow-400'
                                }`}>
                                    {tx.type === TransactionType.INCOME ? '+' : '-'}{formatCurrency(tx.amount)}
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