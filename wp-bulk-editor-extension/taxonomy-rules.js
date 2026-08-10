((root, factory) => {
  const config = factory();

  if (typeof module === 'object' && module.exports) {
    module.exports = config;
  } else {
    root.WSU_WDS_TAXONOMY_CONFIG = config;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, () => ({
  version: 2,
  source: 'WSU College of Nursing reviewed starter rules',
  managedTaxonomies: [
    { slug: 'category', label: 'Site Categories' },
    { slug: 'post_tag', label: 'University Tags' },
    { slug: 'wsuwp_university_category', label: 'University Categories' },
    { slug: 'wsuwp_university_location', label: 'University Locations' },
    { slug: 'wsuwp_university_org', label: 'University Organizations' }
  ],
  defaults: [
    {
      taxonomy: 'wsuwp_university_org',
      termName: 'College of Nursing',
      postTypes: ['post'],
      reason: 'College of Nursing is the reviewed default organization for Nursing news.'
    },
    {
      taxonomy: 'wsuwp_university_location',
      termName: 'WSU Spokane',
      postTypes: ['post'],
      reason: 'WSU Spokane is the reviewed default location for Nursing news.'
    }
  ],
  homepageAudiences: [
    { categoryName: 'Alumni News', tagName: 'Alumni News' },
    { categoryName: 'Donor News', tagName: 'Donor News' },
    { categoryName: 'Faculty News', tagName: 'Faculty News' },
    { categoryName: 'Staff News', tagName: 'Staff News' },
    { categoryName: 'Student News', tagName: 'Student News' }
  ],
  locationAliases: {
    'WSU Tri-Cities': ['WSU Tri-Cities', 'Tri-Cities campus'],
    'WSU Vancouver': ['WSU Vancouver', 'Vancouver campus'],
    'Yakima County': ['Yakima County'],
    'WSU Pullman': ['WSU Pullman', 'Pullman campus'],
    'Puyallup': ['Puyallup'],
    'WSU Extension': ['WSU Extension'],
    'WSU Global Campus': ['WSU Global Campus', 'Global Campus']
  },
  rules: [
    {
      taxonomy: 'category',
      slug: 'nursing-jobs',
      label: 'Nursing Jobs',
      postTypes: ['nursing-job'],
      always: true,
      reason: 'The open item is a Nursing Job.'
    },
    {
      taxonomy: 'category',
      slug: 'graduate-students',
      label: 'All Graduate Students',
      parentSlug: 'nursing-jobs',
      postTypes: ['nursing-job'],
      phrases: ['PMHNP', 'psychiatric mental health nurse practitioner', 'nurse practitioner', 'DNP', 'graduate students'],
      threshold: 4
    },
    {
      taxonomy: 'category',
      slug: 'undergrads',
      label: 'All Undergrads Statewide',
      parentSlug: 'nursing-jobs',
      postTypes: ['nursing-job'],
      phrases: ['caregiver', 'while in college', 'no experience required', 'undergraduate students'],
      threshold: 4
    },
    {
      taxonomy: 'category',
      slug: 'student-news',
      label: 'Student News',
      postTypes: ['post'],
      phrases: ['student news', 'student blog', 'student reflection', 'students in Zambia', 'nursing students'],
      threshold: 1
    },
    {
      taxonomy: 'category',
      slug: 'international-program',
      label: 'International Program',
      postTypes: ['post'],
      phrases: ['international program', 'global learning', 'students in Zambia', 'Zambia'],
      threshold: 1
    },
    {
      taxonomy: 'category',
      slug: 'alumni-news',
      label: 'Alumni News',
      postTypes: ['post'],
      phrases: ['alumni news', 'WSU alumni', 'WSU alums'],
      threshold: 1
    },
    {
      taxonomy: 'category',
      slug: 'continuing-education',
      label: 'Continuing Education',
      postTypes: ['post'],
      phrases: ['continuing education', 'nurse educator conference', 'professional development'],
      threshold: 4
    },
    {
      taxonomy: 'category',
      slug: 'faculty-news',
      label: 'Faculty News',
      postTypes: ['post'],
      phrases: ['faculty news', 'faculty research', 'College of Nursing faculty'],
      threshold: 3
    },
    {
      taxonomy: 'category',
      slug: 'donor-news',
      label: 'Donor News',
      postTypes: ['post'],
      phrases: ['donor news', 'donor gift', 'philanthropic gift', 'support from donors'],
      threshold: 3
    },
    {
      taxonomy: 'category',
      slug: 'staff-news',
      label: 'Staff News',
      postTypes: ['post'],
      phrases: ['staff news', 'staff recognition', 'College of Nursing staff'],
      threshold: 3
    },
    {
      taxonomy: 'category',
      slug: 'phd',
      label: 'PhD',
      parentSlug: 'graduate',
      postTypes: ['post'],
      phrases: ['PhD program', 'doctoral education', 'PhD research'],
      threshold: 1
    },
    {
      taxonomy: 'category',
      slug: 'research',
      label: 'Research',
      postTypes: ['post'],
      phrases: ['faculty research', 'research article', 'recent publications', 'research findings'],
      threshold: 2
    },
    {
      taxonomy: 'wsuwp_university_category',
      slug: 'research',
      label: 'Research',
      postTypes: ['post'],
      phrases: ['faculty research', 'research article', 'recent publications', 'research findings'],
      threshold: 2
    },
    {
      taxonomy: 'post_tag',
      slug: 'rural-health',
      label: 'Rural Health',
      postTypes: ['post'],
      phrases: ['rural health', 'rural nursing'],
      threshold: 3
    },
    {
      taxonomy: 'post_tag',
      slug: 'rural-nursing-pathway',
      label: 'Rural Nursing Pathway',
      postTypes: ['post'],
      phrases: ['rural nursing pathway'],
      threshold: 3
    },
    {
      taxonomy: 'post_tag',
      slug: 'international-program',
      label: 'International Program',
      postTypes: ['post'],
      phrases: ['international program', 'global learning', 'students in Zambia'],
      threshold: 1
    },
    {
      taxonomy: 'post_tag',
      slug: 'zambia',
      label: 'Zambia',
      postTypes: ['post'],
      phrases: ['Zambia'],
      threshold: 1
    },
    {
      taxonomy: 'post_tag',
      slug: 'continuing-education',
      label: 'Continuing Education',
      postTypes: ['post'],
      phrases: ['continuing education', 'nurse educator conference', 'professional development'],
      threshold: 4
    },
    {
      taxonomy: 'post_tag',
      slug: 'dr-connie-nguyen-truong',
      label: 'Dr. Connie Nguyen-Truong',
      postTypes: ['post'],
      phrases: ['Connie Nguyen-Truong', 'Connie Kim Yen Nguyen-Truong'],
      threshold: 1
    },
    {
      taxonomy: 'post_tag',
      slug: 'dr-marian-wilson',
      label: 'Dr. Marian Wilson',
      postTypes: ['post'],
      phrases: ['Marian Wilson'],
      threshold: 1
    },
    {
      taxonomy: 'post_tag',
      slug: 'dr-melissa-vera',
      label: 'Dr. Melissa Vera',
      postTypes: ['post'],
      phrases: ['Melissa Vera'],
      threshold: 1
    },
    {
      taxonomy: 'post_tag',
      slug: 'opioid-addiction',
      label: 'Opioid Addiction',
      postTypes: ['post'],
      phrases: ['opioid addiction', 'opioid risk', 'opioid risks'],
      threshold: 2
    },
    {
      taxonomy: 'post_tag',
      slug: 'phd-program',
      label: 'PhD Program',
      postTypes: ['post'],
      phrases: ['PhD program'],
      threshold: 1
    },
    {
      taxonomy: 'post_tag',
      slug: 'phd-research',
      label: 'phd research',
      postTypes: ['post'],
      phrases: ['PhD research', 'doctoral research'],
      threshold: 1
    },
    {
      taxonomy: 'post_tag',
      slug: 'planetary-health',
      label: 'Planetary Health',
      postTypes: ['post'],
      phrases: ['planetary health'],
      threshold: 1
    }
  ]
}));
