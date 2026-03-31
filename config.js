window.SMART_CAPTURE_CONFIG = {
  brandName: "Vector Algorithmics",
  funnelKey: "vector-strategy-session",
  pageTitle: "Book a Strategy Session | Vector Algorithmics",
  stepLabels: {
    form: "Fill out the form",
    booking: "Book your event"
  },
  hero: {
    eyebrow: "Vector screening",
    title: "Book a Strategy Session",
    description: "Answer two quick questions first so the calendar opens only for qualified leads."
  },
  calendar: {
    url: "https://links.vectoralgorithmics.io/widget/booking/ZbJz8TUtlfMCWK4WKtVo",
    title: "Live strategy calendar",
    kicker: "Times shown in your timezone",
    note: "Please fill out the form before choosing your time slot.",
    embedScriptUrl: "https://links.vectoralgorithmics.io/js/form_embed.js",
    confirmationPath: "/confirmation",
    allowedMessageOrigins: [
      "https://api.leadconnectorhq.com",
      "https://links.vectoralgorithmics.io",
      "https://link.msgsndr.com"
    ]
  },
  privacy: {
    text: "By entering your information, you consent to your data being saved in accordance with our",
    linkLabel: "Privacy Policy",
    linkUrl: "https://start.vectoralgorithmics.com/privacy-policy"
  },
  storage: {
    supabaseUrl: "",
    supabaseAnonKey: "",
    table: "smart_leads",
    eventsTable: "smart_lead_events",
    webhookUrl: ""
  },
  ghl: {
    apiToken: "pit-25a96551-8770-4f0d-946c-6c72f7d9e763",
    locationId: "dlGhpYm3nOX6E7eC0Sdr",
    source: "Smart Capture - Strategy Session",
    tags: ["smart-capture", "strategy-session", "smart-capture-optin"],
    customFieldMap: {
      capital_range: "contact.capital_range",
      timeline: "contact.timeline"
    },
    pipeline: {
      id: "ndXBIdMJQV7KGR69HO0L",
      stageId: "6adc41c9-583e-4180-923d-d969a25be72c"
    }
  },
  legalLinks: [
    {
      label: "Privacy",
      url: "https://start.vectoralgorithmics.com/privacy-policy"
    },
    {
      label: "Terms",
      url: "https://start.vectoralgorithmics.com/terms-of-service"
    },
    {
      label: "Disclaimer",
      url: "https://start.vectoralgorithmics.com/disclaimer"
    }
  ],
  steps: [
    {
      id: "qualification",
      title: "A few quick fit questions",
      description: "Help us understand your situation so we can make the most of our time together.",
      buttonLabel: "Continue",
      fields: [
        {
          id: "capital_range",
          label: "Do you have a minimum of $80k capital?",
          type: "radio",
          required: true,
          requiredMessage: "Please select an answer.",
          options: [
            {
              label: "Yes",
              value: "yes"
            },
            {
              label: "No",
              value: "no"
            }
          ]
        },
        {
          id: "timeline",
          label: "When are you looking to get started?",
          type: "select",
          placeholder: "Select timing",
          options: [
            {
              label: "Immediately",
              value: "immediately"
            },
            {
              label: "Within 30 days",
              value: "30_days"
            },
            {
              label: "Within 90 days",
              value: "90_days"
            },
            {
              label: "Just researching",
              value: "researching"
            }
          ]
        }
      ]
    },
    {
      id: "contact",
      title: "Last step — your contact info",
      description: "So we can send you the calendar invite and follow up if needed.",
      buttonLabel: "Continue",
      progressive: true,
      fields: [
        {
          id: "first_name",
          leadField: "first_name",
          label: "First name",
          type: "text",
          placeholder: "John",
          autoComplete: "given-name",
          required: true,
          requiredMessage: "Please enter your first name.",
          revealGroup: 0
        },
        {
          id: "last_name",
          leadField: "last_name",
          label: "Last name",
          type: "text",
          placeholder: "Smith",
          autoComplete: "family-name",
          required: true,
          requiredMessage: "Please enter your last name.",
          revealGroup: 0
        },
        {
          id: "email",
          leadField: "email",
          label: "Email",
          type: "email",
          placeholder: "john@company.com",
          autoComplete: "email",
          required: true,
          validationMessage: "Please enter a valid email.",
          revealGroup: 1
        },
        {
          id: "phone",
          leadField: "phone",
          label: "Phone",
          type: "tel",
          placeholder: "+1 (555) 123-4567",
          autoComplete: "tel",
          hint: "We use this to send a text in case there are issues with the meeting link.",
          revealGroup: 2
        }
      ]
    }
  ],
  qualification: {
    mode: "all",
    rules: [
      {
        field: "capital_range",
        operator: "in",
        value: ["yes"],
        label: "Capital threshold met"
      }
    ],
    success: {
      title: "You are all set",
      description: "",
      buttonLabel: "",
      highlights: []
    },
    failure: {
      title: "Thanks for your interest",
      description: "Our managed accounts currently require a minimum allocation of $80k. If that changes, use the link below and we can revisit fit.",
      ctaLabel: "Review eligibility",
      ctaUrl: "https://start.vectoralgorithmics.com/"
    }
  }
};
