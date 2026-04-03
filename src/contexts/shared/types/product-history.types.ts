/**
 * Types for product history tracking
 */

/**
 * Entry in quotation history - tracks past price quotes for a product
 */
export interface QuotationHistoryEntry {
  /** Date when the quotation was made */
  date: Date;
  /** ID of the quotation */
  quotationId: number;
  /** ID of the provider who quoted */
  providerId?: number;
  /** Name of the provider */
  providerName?: string;
  /** RUT of the provider */
  providerRut?: string;
  /** Quoted price per unit */
  price: number;
  /** Quantity quoted */
  quantity: number;
  /** Currency used (default CLP) */
  currency?: string;
  /** Status of the quotation */
  status?: 'pending' | 'awarded' | 'not_awarded' | 'partial';
}

/**
 * Entry in adjudication history - tracks who won/lost bids for a product
 */
export interface AdjudicationHistoryEntry {
  /** Date when the adjudication was made */
  date: Date;
  /** ID of the licitation */
  licitationId: number;
  /** Call number of the licitation */
  callNumber?: string;
  /** Name of the provider who won */
  winnerName?: string;
  /** RUT of the provider who won */
  winnerRut?: string;
  /** Winning price per unit */
  winnerPrice?: number;
  /** Quantity awarded */
  quantity: number;
  /** Brand of the product in this adjudication */
  brand?: string;
  /** Competitor information (for lost bids) */
  competitorName?: string;
  competitorRut?: string;
  competitorPrice?: number;
  competitorBrand?: string;
}

/**
 * Summary statistics for product history
 */
export interface ProductHistorySummary {
  /** Total number of quotations */
  totalQuotations: number;
  /** Total number of adjudications */
  totalAdjudications: number;
  /** Average quoted price */
  averagePrice: number;
  /** Lowest quoted price */
  lowestPrice: number;
  /** Highest quoted price */
  highestPrice: number;
  /** Most frequent winner */
  topWinner?: string;
}
