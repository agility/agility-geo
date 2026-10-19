/**
 * A compact list of commonly used schema.org types, for the validator's "unknown type" warning.
 *
 * This is deliberately not the whole vocabulary (about 800 types); it covers the types sites and
 * Google's rich results commonly use. A type missing from it produces a warning, never an error.
 */
export const COMMON_SCHEMA_TYPES: readonly string[] = [
  // Things and creative works
  "Thing", "CreativeWork", "CreativeWorkSeries", "Collection", "WebContent",
  "Article", "NewsArticle", "BlogPosting", "TechArticle", "ScholarlyArticle", "Report", "AnalysisNewsArticle",
  "OpinionNewsArticle", "ReportageNewsArticle", "SocialMediaPosting", "DiscussionForumPosting", "Comment",
  "Blog", "Book", "Chapter", "Periodical", "Guide", "Thesis", "Legislation", "Map", "Photograph",
  "Quiz", "LearningResource", "Course", "CourseInstance", "Syllabus", "Dataset", "DataCatalog", "DataDownload",
  "SoftwareSourceCode", "Movie", "TVSeries", "TVEpisode", "MusicRecording", "MusicAlbum", "MusicPlaylist",
  "MusicGroup", "PodcastSeries", "PodcastEpisode", "Claim", "ClaimReview", "Recipe", "NutritionInformation",
  "Menu", "MenuSection", "MenuItem", "HowTo", "HowToStep", "HowToSection", "HowToDirection", "HowToTip",
  "HowToSupply", "HowToTool", "DefinedTerm", "DefinedTermSet", "SpeakableSpecification", "WebPageElement",
  "SiteNavigationElement", "WPHeader", "WPFooter", "WPSideBar", "Table",
  // Pages and sites
  "WebSite", "WebPage", "AboutPage", "ContactPage", "CollectionPage", "FAQPage", "ItemPage", "ProfilePage",
  "QAPage", "SearchResultsPage", "CheckoutPage", "MedicalWebPage", "RealEstateListing", "ImageGallery",
  "MediaGallery", "VideoGallery",
  // Media
  "MediaObject", "ImageObject", "VideoObject", "AudioObject", "Clip", "BroadcastEvent",
  // Organizations and people
  "Organization", "Corporation", "OnlineBusiness", "OnlineStore", "NGO", "GovernmentOrganization",
  "EducationalOrganization", "CollegeOrUniversity", "School", "MedicalOrganization", "Hospital",
  "NewsMediaOrganization", "SportsOrganization", "SportsTeam", "Project", "ResearchProject", "Person",
  "Occupation", "EducationalOccupationalCredential", "ContactPoint", "Brand", "Audience", "Language",
  // Local businesses
  "LocalBusiness", "Store", "Restaurant", "FoodEstablishment", "CafeOrCoffeeShop", "Bakery", "BarOrPub",
  "ProfessionalService", "FinancialService", "LegalService", "Attorney", "AccountingService", "RealEstateAgent",
  "EmploymentAgency", "TravelAgency", "MedicalBusiness", "Dentist", "Physician", "HealthAndBeautyBusiness",
  "HomeAndConstructionBusiness", "AutomotiveBusiness", "LodgingBusiness", "Hotel", "EntertainmentBusiness",
  "SportsActivityLocation",
  // Places
  "Place", "PostalAddress", "GeoCoordinates", "GeoShape", "VirtualLocation", "Country", "State", "City",
  "AdministrativeArea", "DefinedRegion", "CivicStructure", "Airport", "Museum", "Park", "MusicVenue",
  "StadiumOrArena", "TouristAttraction", "TouristDestination", "LandmarksOrHistoricalBuildings",
  "Accommodation", "Room", "Residence", "Apartment", "House", "OpeningHoursSpecification",
  // Commerce
  "Product", "ProductGroup", "ProductModel", "IndividualProduct", "Service", "FinancialProduct", "Vehicle", "Car",
  "Offer", "AggregateOffer", "OfferCatalog", "Demand", "PriceSpecification", "UnitPriceSpecification",
  "CompoundPriceSpecification", "MonetaryAmount", "QuantitativeValue", "PropertyValue", "MerchantReturnPolicy",
  "OfferShippingDetails", "ShippingDeliveryTime", "Order", "Invoice", "Ticket", "Reservation", "Trip",
  "SoftwareApplication", "MobileApplication", "WebApplication", "VideoGame",
  // Reviews and ratings
  "Review", "CriticReview", "EmployerReview", "Rating", "AggregateRating", "EmployerAggregateRating",
  // Events
  "Event", "BusinessEvent", "EducationEvent", "MusicEvent", "SportsEvent", "Festival", "ExhibitionEvent",
  "SocialEvent", "TheaterEvent", "Hackathon", "EventSeries", "Schedule",
  // Jobs
  "JobPosting",
  // Q&A and lists
  "Question", "Answer", "ItemList", "ListItem", "BreadcrumbList", "HowToItem",
  // Actions and interaction
  "Action", "SearchAction", "ReadAction", "BuyAction", "OrderAction", "WatchAction", "ListenAction",
  "SubscribeAction", "EntryPoint", "InteractionCounter",
  // Health
  "MedicalCondition", "Drug",
  // Grants and funding
  "Grant", "MonetaryGrant", "FundingScheme",
];
