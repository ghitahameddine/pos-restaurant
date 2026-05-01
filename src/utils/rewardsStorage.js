const REWARDS_STORAGE_KEY = 'pos2-rewards-profile';

const defaultProfile = {
  clientName: '',
  totalPoints: 0,
  orderCount: 0,
  claimedRewards: [],
  orderHistory: [],
};

export function getRewardsProfile() {
  const rawProfile = localStorage.getItem(REWARDS_STORAGE_KEY);

  if (!rawProfile) {
    return defaultProfile;
  }

  try {
    return { ...defaultProfile, ...JSON.parse(rawProfile) };
  } catch {
    return defaultProfile;
  }
}

export function saveRewardsProfile(profile) {
  localStorage.setItem(REWARDS_STORAGE_KEY, JSON.stringify(profile));
  return profile;
}

export function addRewardPoints({ clientName, points }) {
  const currentProfile = getRewardsProfile();
  const nextProfile = {
    ...currentProfile,
    clientName: clientName || currentProfile.clientName,
    totalPoints: currentProfile.totalPoints + points,
    orderCount: currentProfile.orderCount + 1,
  };

  return saveRewardsProfile(nextProfile);
}

export function addOrderToHistory(order) {
  const currentProfile = getRewardsProfile();
  const alreadyExists = currentProfile.orderHistory.some((item) => item.id === order.id);

  if (alreadyExists) {
    return currentProfile;
  }

  const nextProfile = {
    ...currentProfile,
    clientName: order.clientName || currentProfile.clientName,
    orderHistory: [order, ...currentProfile.orderHistory],
  };

  return saveRewardsProfile(nextProfile);
}
