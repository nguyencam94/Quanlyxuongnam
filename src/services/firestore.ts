import { 
  collection, 
  onSnapshot, 
  query, 
  orderBy, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  Timestamp,
  where
} from 'firebase/firestore';
import { db, auth } from '../firebase';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: any;
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Transactions
export const subscribeTransactions = (callback: (data: any[]) => void) => {
  const q = query(collection(db, 'transactions'), orderBy('date', 'desc'));
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  }, (error) => handleFirestoreError(error, OperationType.LIST, 'transactions'));
};

export const addTransaction = async (data: any) => {
  try {
    return await addDoc(collection(db, 'transactions'), {
      ...data,
      date: Timestamp.fromDate(new Date(data.date)),
      createdBy: auth.currentUser?.uid
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'transactions');
  }
};

export const updateTransaction = async (transactionId: string, data: any) => {
  try {
    const transRef = doc(db, 'transactions', transactionId);
    let dateVal: Timestamp;
    if (data.date?.toDate) {
      dateVal = data.date;
    } else if (data.date instanceof Date) {
      dateVal = Timestamp.fromDate(data.date);
    } else if (typeof data.date === 'string') {
      const parts = data.date.split('-');
      if (parts.length === 3) {
        const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10), 12, 0, 0);
        dateVal = Timestamp.fromDate(d);
      } else {
        dateVal = Timestamp.fromDate(new Date(data.date));
      }
    } else {
      dateVal = Timestamp.now();
    }

    const updatePayload: any = {
      type: data.type,
      amount: Number(data.amount),
      category: data.category || '',
      description: data.description || '',
      date: dateVal
    };

    if (data.type === 'expense' && data.planId) {
      updatePayload.planId = data.planId;
      updatePayload.planTitle = data.planTitle || '';
    } else {
      updatePayload.planId = null;
      updatePayload.planTitle = null;
    }

    if (data.campaignId) {
      updatePayload.campaignId = data.campaignId;
      updatePayload.campaignName = data.campaignName || '';
    } else if (data.campaignId === null || data.campaignId === '') {
      updatePayload.campaignId = null;
      updatePayload.campaignName = null;
    }

    if (data.budgetItemId) {
      updatePayload.budgetItemId = data.budgetItemId;
    }

    await updateDoc(transRef, updatePayload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `transactions/${transactionId}`);
  }
};

export const deleteTransaction = async (transactionId: string) => {
  try {
    await deleteDoc(doc(db, 'transactions', transactionId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `transactions/${transactionId}`);
  }
};

// Orders
export const subscribeOrders = (callback: (data: any[]) => void) => {
  const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  }, (error) => handleFirestoreError(error, OperationType.LIST, 'orders'));
};

export const addOrder = async (data: any) => {
  try {
    const orderData = { ...data };
    if (data.orderTime && typeof data.orderTime === 'string') {
      orderData.orderTime = Timestamp.fromDate(new Date(data.orderTime));
    } else {
      orderData.orderTime = Timestamp.now();
    }
    return await addDoc(collection(db, 'orders'), {
      ...orderData,
      createdAt: Timestamp.now(),
      createdBy: auth.currentUser?.uid
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'orders');
  }
};

export const updateOrderStatus = async (orderId: string, status: string) => {
  try {
    const orderRef = doc(db, 'orders', orderId);
    await updateDoc(orderRef, { status });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `orders/${orderId}`);
  }
};

// Workers
export const subscribeWorkers = (callback: (data: any[]) => void) => {
  const q = query(collection(db, 'workers'), orderBy('name', 'asc'));
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  }, (error) => handleFirestoreError(error, OperationType.LIST, 'workers'));
};

export const addWorker = async (data: any) => {
  try {
    return await addDoc(collection(db, 'workers'), data);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'workers');
  }
};

// Plans
export const subscribePlans = (callback: (data: any[]) => void) => {
  const q = query(collection(db, 'plans'), orderBy('startDate', 'asc'));
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  }, (error) => handleFirestoreError(error, OperationType.LIST, 'plans'));
};

export const addPlan = async (data: any) => {
  try {
    const sDate = data.startDate ? new Date(data.startDate) : new Date();
    const eDate = data.endDate ? new Date(data.endDate) : sDate;
    return await addDoc(collection(db, 'plans'), {
      ...data,
      startDate: Timestamp.fromDate(sDate),
      endDate: Timestamp.fromDate(eDate),
      subtasks: data.subtasks || []
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'plans');
  }
};

export const updatePlan = async (planId: string, data: any) => {
  try {
    const planRef = doc(db, 'plans', planId);
    const updateData = { ...data };
    if (data.startDate && typeof data.startDate === 'string') {
      updateData.startDate = Timestamp.fromDate(new Date(data.startDate));
    }
    if (data.endDate && typeof data.endDate === 'string') {
      updateData.endDate = Timestamp.fromDate(new Date(data.endDate));
    }
    if (data.originalStartDate && typeof data.originalStartDate === 'string') {
      updateData.originalStartDate = Timestamp.fromDate(new Date(data.originalStartDate));
    }
    if (data.originalEndDate && typeof data.originalEndDate === 'string') {
      updateData.originalEndDate = Timestamp.fromDate(new Date(data.originalEndDate));
    }
    await updateDoc(planRef, updateData);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `plans/${planId}`);
  }
};

export const extendPlan = async (
  planId: string,
  currentPlan: any,
  newDateStr: string,
  reason?: string
) => {
  try {
    const planRef = doc(db, 'plans', planId);
    const prevDeadline = currentPlan.endDate?.toDate 
      ? currentPlan.endDate.toDate() 
      : (currentPlan.endDate 
          ? new Date(currentPlan.endDate) 
          : (currentPlan.startDate?.toDate ? currentPlan.startDate.toDate() : new Date(currentPlan.startDate)));
    const newDate = new Date(newDateStr);
    const prevCount = currentPlan.extensionCount || (currentPlan.extensions?.length || 0);
    const newCount = prevCount + 1;

    const extensionEntry = {
      id: Math.random().toString(36).substring(2, 9),
      extensionNumber: newCount,
      extendedAt: new Date().toISOString(),
      previousDate: prevDeadline.toISOString(),
      newDate: newDate.toISOString(),
      reason: reason?.trim() || 'Gia hạn thời hạn hoàn thành mục tiêu'
    };

    const existingExtensions = currentPlan.extensions || [];
    const updatedExtensions = [...existingExtensions, extensionEntry];

    const updateData: any = {
      endDate: Timestamp.fromDate(newDate),
      extensionCount: newCount,
      extensions: updatedExtensions,
    };

    // If originalEndDate is not set yet, preserve the first deadline
    if (!currentPlan.originalEndDate) {
      updateData.originalEndDate = Timestamp.fromDate(prevDeadline);
    }

    await updateDoc(planRef, updateData);
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `plans/${planId}`);
    return false;
  }
};

export const deletePlan = async (planId: string) => {
  try {
    await deleteDoc(doc(db, 'plans', planId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `plans/${planId}`);
  }
};

// Campaigns (Chiến dịch / Đợt vào nấm)
export const subscribeCampaigns = (callback: (data: any[]) => void) => {
  const q = query(collection(db, 'campaigns'), orderBy('startDate', 'desc'));
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  }, (error) => handleFirestoreError(error, OperationType.LIST, 'campaigns'));
};

export const addCampaign = async (data: any) => {
  try {
    const sDate = data.startDate ? new Date(data.startDate) : new Date();
    const payload: any = {
      ...data,
      name: data.name?.trim() || 'Chiến dịch mới',
      status: data.status || 'active',
      startDate: Timestamp.fromDate(sDate),
      createdAt: Timestamp.now(),
      createdBy: auth.currentUser?.uid
    };
    if (data.endDate) {
      payload.endDate = Timestamp.fromDate(new Date(data.endDate));
    }
    if (data.totalBags !== undefined && data.totalBags !== '') {
      payload.totalBags = Number(data.totalBags);
    }
    if (data.expectedYield !== undefined && data.expectedYield !== '') {
      payload.expectedYield = Number(data.expectedYield);
    }
    if (data.actualYield !== undefined && data.actualYield !== '') {
      payload.actualYield = Number(data.actualYield);
    }
    return await addDoc(collection(db, 'campaigns'), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'campaigns');
  }
};

export const updateCampaign = async (campaignId: string, data: any) => {
  try {
    const campaignRef = doc(db, 'campaigns', campaignId);
    const updateData: any = { ...data };
    if (data.startDate) {
      if (typeof data.startDate === 'string') {
        updateData.startDate = Timestamp.fromDate(new Date(data.startDate));
      } else if (data.startDate instanceof Date) {
        updateData.startDate = Timestamp.fromDate(data.startDate);
      }
    }
    if (data.endDate) {
      if (typeof data.endDate === 'string') {
        updateData.endDate = Timestamp.fromDate(new Date(data.endDate));
      } else if (data.endDate instanceof Date) {
        updateData.endDate = Timestamp.fromDate(data.endDate);
      }
    } else if (data.endDate === null || data.endDate === '') {
      updateData.endDate = null;
    }
    if (data.totalBags !== undefined && data.totalBags !== '') {
      updateData.totalBags = Number(data.totalBags);
    }
    if (data.expectedYield !== undefined && data.expectedYield !== '') {
      updateData.expectedYield = Number(data.expectedYield);
    }
    if (data.actualYield !== undefined && data.actualYield !== '') {
      updateData.actualYield = Number(data.actualYield);
    }
    await updateDoc(campaignRef, updateData);
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `campaigns/${campaignId}`);
    return false;
  }
};

export const deleteCampaign = async (campaignId: string) => {
  try {
    await deleteDoc(doc(db, 'campaigns', campaignId));
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `campaigns/${campaignId}`);
    return false;
  }
};
