import BN from 'bn.js'

export type Volume = number

interface MarketplaceStats {
  nfts: Volume
}

interface CreatorCounts {
  creations: number
}

export interface MarktetplaceMetaPayload {
  name: string
  description: string
}

export interface FileUploadPayload {
  name: string | undefined
  type: string | undefined
  url: string
}

export interface MarketplaceThemePayload {
  logo: FileUploadPayload
  banner: FileUploadPayload
}

export interface MarketplaceCreatorPayload {
  address: string
}

export interface MarketplaceAddressPayload {
  owner?: string
  store?: string
  storeConfig?: string
}
interface MarketplaceAuctionHousePayload {
  address: string
}
export interface MarktplaceSettingsPayload {
  meta: MarktetplaceMetaPayload
  theme: MarketplaceThemePayload
  creators: MarketplaceCreatorPayload[]
  subdomain: string
  address: MarketplaceAddressPayload
  auctionHouses?: MarketplaceAuctionHousePayload[]
}

export interface Marketplace {
  subdomain: string
  name: string
  description: string
  logoUrl: string
  bannerUrl: string
  auctionHouses: AuctionHouse[]
  ownerAddress: string
  creators?: MarketplaceCreator[]
  stats?: MarketplaceStats
}

interface GraphQLObject {
  __typename: string
}

export interface MarketplaceCreator {
  creatorAddress: string
  storeConfigAddress: string
  preview?: Nft[]
  nftCount?: number
}

export interface AuctionHouse {
  address: string
  treasuryMint: string
  auctionHouseTreasury: string
  treasuryWithdrawalDestination: string
  feeWithdrawalDestination: string
  authority: string
  creator: string
  auctionHouseFeeAccount: string
  bump?: number
  treasuryBump?: number
  feePayerBump?: number
  sellerFeeBasisPoints?: number
  requiresSignOff?: boolean
  canChangeSalePrice?: boolean
  stats?: MintStats
}

export interface AttributeVariant {
  name: string
  count: number
}

export interface AttributeGroup {
  name: string
  variants: AttributeVariant[]
}

export interface MintStats {
  volume24hr: BN
  volumeTotal: BN
  average: BN
  floor: BN
  mint: string
  auctionHouse: AuctionHouse
}
export interface Creator extends UserWallet {
  attributeGroups: AttributeGroup[]
  stats: MintStats[]
  counts: CreatorCounts
}

export interface NftAttribute {
  value: string
  traitType: string
}

export interface UserWallet {
  address: string
  profile?: TwitterProfile | null
}

export interface NftOwnerWallet extends UserWallet {
  associatedTokenAccountAddress: string
  twitterHandle?: string
}

export interface NftCreatorWallet extends UserWallet {
  twitterHandle?: string
  metadataAddress: string
  share: number
  verified: boolean
  position: number
}

export interface Listing {
  address: string
  auctionHouse: AuctionHouse
  bookkepper: string
  seller: string
  metadata: string
  purchaseReceipt: string
  price: BN
  tokenSize: number
  bump: number
  tradeState: string
  tradeStateBump: number
  createdAt: string
  canceledAt: string
}

export interface Purchase {
  address: string
  buyer: string
  seller: string
  auctionHouse: AuctionHouse
  price: BN
  createdAt: string
}

export interface Offer {
  address: string
  buyer: string
  price: BN
  createdAt: string
  auctionHouse: AuctionHouse
  tradeState: string
}

export interface NftFile {
  fileType: String
  uri: String
}

interface AddressKeyType {
  [address: string]: string
}

export type KeyType = AddressKeyType

export interface Nft {
  name: string
  address: string
  description?: string
  image?: string
  sellerFeeBasisPoints?: number
  mintAddress: string
  attributes?: NftAttribute[]
  creators: UserWallet[]
  owner: NftOwnerWallet
  listings?: Listing[]
  purchases?: Purchase[]
  offers?: Offer[]
  activities?: Activity[]
  files?: NftFile[]
  category?: string
  primarySaleHappened?: boolean
  createdAt?: string
}

export interface AttributeFilter {
  traitType: string
  values: string[]
}

export enum PresetNftFilter {
  All = 'All',
  Listed = 'Listed',
  Owned = 'Owned',
  OpenOffers = 'OpenOffers',
}

export interface Viewer extends GraphQLObject {
  id: string
  balance: number
}

export enum PresetEditFilter {
  Marketplace = 'Marketplace',
  Creators = 'Creators',
}

export enum ActivityType {
  Listed = 'listing',
  Sold = 'purchase',
}
export interface Activity {
  address: string
  metadata: string
  auctionHouse: AuctionHouse
  price: BN
  createdAt: string
  wallets: string[]
  activityType: string
  nft: Nft
}

export interface TwitterProfile {
  handle: string
  description?: string
  walletAddress?: string
  bannerImageUrl?: string
  /**
   * @deprecated
   */
  profileImageUrl?: string
  profileImageUrlLowres?: string
  profileImageUrlHighres?: string
}

export interface NftCount {
  total: number
  listed: number
}

export interface NftOwner extends UserWallet {
  associatedTokenAccountAddress: string
  twitterHandle: string
}
export interface Wallet extends UserWallet {
  nftCounts: WalletNftCount
  connectionCounts: ConnectionCounts
}

export interface WalletNftCount {
  owned: number
  offered: number
  listed: number
}

export interface ConnectionCounts {
  fromCount: number
  toCount: number
}

export interface PricePoint {
  price: BN
  date: string
}

export interface PriceChart {
  listingFloor: PricePoint[]
  salesAverage: PricePoint[]
  totalVolume: PricePoint[]
}

export interface GetPriceChartData {
  charts: PriceChart
}

export interface GetActivities {
  activities: Activity[]
}

export interface GetNftData {
  nft: Nft
}
