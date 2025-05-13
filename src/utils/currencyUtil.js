export const formatToRupees = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount);
  };
  
  export const calculateProfitLoss = (currentAmount, previousAmount) => {
    if (!previousAmount) return { value: 0, percentage: 0 };
    const difference = currentAmount - previousAmount;
    const percentage = (difference / previousAmount) * 100;
    return {
      value: difference,
      percentage: Math.round(percentage * 100) / 100
    };
  }; 