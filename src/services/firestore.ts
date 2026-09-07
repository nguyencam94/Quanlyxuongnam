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
    return await addDoc(collection(db, 'plans'), {
      ...data,
      startDate: Timestamp.fromDate(new Date(data.startDate)),
      endDate: data.endDate ? Timestamp.fromDate(new Date(data.endDate)) : null,
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
    const prevDate = currentPlan.startDate?.toDate ? currentPlan.startDate.toDate() : new Date(currentPlan.startDate);
    const newDate = new Date(newDateStr);
    const prevCount = currentPlan.extensionCount || (currentPlan.extensions?.length || 0);
    const newCount = prevCount + 1;

    const extensionEntry = {
      id: Math.random().toString(36).substring(2, 9),
      extensionNumber: newCount,
      extendedAt: new Date().toISOString(),
      previousDate: prevDate.toISOString(),
      newDate: newDate.toISOString(),
      reason: reason?.trim() || 'Gia hạn thời gian hoàn thành'
    };

    const existingExtensions = currentPlan.extensions || [];
    const updatedExtensions = [...existingExtensions, extensionEntry];

    const updateData: any = {
      startDate: Timestamp.fromDate(newDate),
      extensionCount: newCount,
      extensions: updatedExtensions,
    };

    // If originalStartDate is not set yet, preserve the first startDate
    if (!currentPlan.originalStartDate) {
      updateData.originalStartDate = Timestamp.fromDate(prevDate);
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
