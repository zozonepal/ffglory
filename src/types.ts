export type UserRole = "user" | "admin";

export interface UserProfile {
  uid: string;
  email: string;
  username?: string;
  role: UserRole;
  credits: number;
  createdAt: number | string;
}

export interface LaunchLog {
  id: string;
  server: string;
  guild_id: string;
  status: "success" | "failed";
  creditsDeducted: number;
  timestamp: number;
  apiResponse?: any;
  error?: string;
}

export interface PaymentRequest {
  id: string;
  userId: string;
  userEmail: string;
  amountRs: number;
  credits: number;
  transactionId: string;
  paymentMethod?: "esewa" | "khalti" | "qr" | "bank" | string;
  proofUrl?: string;
  status: "pending" | "approved" | "rejected";
  createdAt: number;
  updatedAt?: number;
  processedBy?: string;
}

export interface PaymentSettings {
  qrCodeUrl: string; // General Nepali QR / Fonepay
  esewaId?: string;
  esewaQrUrl?: string;
  khaltiId?: string;
  khaltiQrUrl?: string;
  accountName?: string;
  ratePerCreditRs?: number;
  instructions?: string;
  updatedAt?: number;
  upiId?: string; // Legacy fallback
}

export interface ProviderBalanceResponse {
  balance?: number;
  credits?: number;
  status?: string;
  [key: string]: any;
}

export interface FonepayCreateQrResponse {
  amount: string;
  billId: string;
  fonepayPanNumber: string;
  location: string;
  qrMessage: string;
  success: boolean;
  terminalName: string;
}

export interface FonepayVerifyResponse {
  message?: string;
  success: boolean;
  verified: boolean;
  [key: string]: any;
}


export interface Coupon {
  code: string;
  credits: number;
  maxUses: number;
  usedCount: number;
  usedBy?: Record<string, number>;
  active: boolean;
  createdAt: number;
  createdBy?: string;
  note?: string;
}

export interface CouponRedemption {
  id: string;
  code: string;
  credits: number;
  timestamp: number;
  status: "success" | "invalid" | "exhausted" | "already_redeemed";
}

export interface ServerRegion {
  code: string;
  name: string;
  flag: string;
  region: string;
  description: string;
}

export const SUPPORTED_SERVERS: ServerRegion[] = [
  { code: "IND", name: "India", flag: "🇮🇳", region: "South Asia", description: "India & South Asian clan glory nodes" },
  { code: "BD", name: "Bangladesh", flag: "🇧🇩", region: "South Asia", description: "Dedicated Bangladesh high-speed guild cluster" },
  { code: "PK", name: "Pakistan", flag: "🇵🇰", region: "South Asia", description: "Pakistan low-latency automated routing" },
  { code: "ID", name: "Indonesia", flag: "🇮🇩", region: "Southeast Asia", description: "Jakarta hyper-fast clan glory nodes" },
  { code: "US", name: "United States", flag: "🇺🇸", region: "North America", description: "US East & West enterprise game nodes" },
  { code: "EU", name: "Europe", flag: "🇪🇺", region: "Europe", description: "Frankfurt & Amsterdam high-capacity cluster" },
  { code: "RU", name: "Russia", flag: "🇷🇺", region: "CIS & Russia", description: "Moscow & Saint Petersburg regional proxy" },
  { code: "BR", name: "Brazil", flag: "🇧🇷", region: "Latin America", description: "São Paulo low-ping Brazilian gateway" },
  { code: "SG", name: "Singapore", flag: "🇸🇬", region: "Southeast Asia", description: "Singapore central Asia-Pacific hub" },
  { code: "VN", name: "Vietnam", flag: "🇻🇳", region: "Southeast Asia", description: "Hanoi & Ho Chi Minh dedicated servers" },
  { code: "TH", name: "Thailand", flag: "🇹🇭", region: "Southeast Asia", description: "Bangkok high-frequency guild workers" },
  { code: "ME", name: "Middle East", flag: "🇲🇪", region: "Middle East", description: "Dubai & MENA zero-loss connection" },
  { code: "NA", name: "North America", flag: "🌎", region: "Americas", description: "Comprehensive North American game cluster" },
  { code: "SAC", name: "South & Central America", flag: "🌎", region: "South America", description: "South and Central America game gateway" },
];

