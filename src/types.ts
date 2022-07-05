import BN from 'bn.js'

export type Volume = number
type Uuid = string

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
  auctionHouse: string
  store?: string
  storeConfig?: string
}
export interface MarktplaceSettingsPayload {
  meta: MarktetplaceMetaPayload
  theme: MarketplaceThemePayload
  creators: MarketplaceCreatorPayload[]
  subdomain: string
  address: MarketplaceAddressPayload
}

export interface Marketplace {
  subdomain: string
  name: string
  description: string
  logoUrl: string
  bannerUrl: string
  auctionHouse: AuctionHouse
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
  average: BN
  floor: BN
  mint: string
  auctionHouse: string
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

export interface NftOwner extends UserWallet {
  associatedTokenAccountAddress: string
  twitterHandle: string
}

export interface NftCreator extends UserWallet {
  twitterHandle?: string
  metadataAddress: string
  share: number
  verified: boolean
  position: number
}

export interface AhListing {
  id: Uuid
  tradeState: string
  auctionHouse: string
  seller: string
  metadata: string
  purchaseId: string
  price: BN
  tokenSize: number
  tradeStateBump: number
  createdAt: string
  canceledAt: string
  nft: Nft
}

export interface Purchase {
  id: Uuid
  buyer: string
  seller: string
  auctionHouse: string
  metadata: string
  price: BN
  createdAt: string
  tokenSize: number
  nft: Nft
}

export interface Offer {
  id: Uuid
  tradeState: string
  buyer: string
  metadata: string
  auctionHouse: string
  price: BN
  purchaseId: Uuid
  tradeStateBump: number
  tokenAccount: string
  createdAt: string
  canceledAt: string
  tokenSize: number
  nft: Nft
}

export interface NftFile {
  metadataAddress: string
  fileType: string
  uri: string
}

export interface Nft {
  address: string
  name: string
  sellerFeeBasisPoints: number
  mintAddress: string
  primarySaleHappened: boolean
  updateAuthorityAddress: string
  description: string
  category: string
  image: string
  creators: NftCreator[]
  attributes?: NftAttribute[]
  owner: NftOwner
  activities?: Activity[]
  listings?: AhListing[]
  purchases?: Purchase[]
  offers?: Offer[]
  files?: NftFile[]
  collection?: Nft
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
  auctionHouse: string
  price: BN
  createdAt: string
  wallets: string[]
  activityType: string
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
