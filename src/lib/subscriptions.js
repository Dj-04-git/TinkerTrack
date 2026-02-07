const subscriptions = [
	{
		id: 'pulse-analytics',
		name: 'Pulse Analytics Suite',
		category: 'SaaS Reporting',
		description:
			'Unified revenue dashboards, cohort insights, and churn forecasting designed for subscription teams.',
		shortDescription: 'Revenue analytics, cohort insight, and churn forecasting in one suite.',
		pricing: {
			monthly: 129,
			sixMonth: 690,
			yearly: 1180
		},
		annualLabel: 'Save 23% annually',
		seats: 'Up to 10 teammates',
		frequency: 'Billed monthly, biannual, or yearly',
		badges: ['Analytics', 'Bestseller'],
		variants: ['Growth (up to 10k customers)', 'Scale (up to 50k customers)', 'Enterprise (custom)'],
		terms: [
			{ label: 'Discounts', value: 'Volume-based' },
			{ label: 'Taxes', value: 'Auto-calculated' },
			{ label: 'Invoice terms', value: 'Net 14' },
			{ label: 'Support', value: 'Priority chat' }
		]
	},
	{
		id: 'retention-lab',
		name: 'Retention Lab',
		category: 'Lifecycle Automation',
		description:
			'Smart playbooks for renewals, delinquency recovery, and lifecycle nudges that feel human.',
		shortDescription: 'Automated renewal playbooks and recovery flows built for SaaS teams.',
		pricing: {
			monthly: 89,
			sixMonth: 470,
			yearly: 820
		},
		annualLabel: 'Save 18% annually',
		seats: 'Up to 5 teammates',
		frequency: 'Billed monthly, biannual, or yearly',
		badges: ['Automation'],
		variants: ['Starter (up to 5k customers)', 'Growth (up to 25k customers)', 'Scale (custom)'],
		terms: [
			{ label: 'Discounts', value: 'Tiered savings' },
			{ label: 'Taxes', value: 'Auto-calculated' },
			{ label: 'Invoice terms', value: 'Net 7' },
			{ label: 'Support', value: 'Guided onboarding' }
		]
	},
	{
		id: 'quotient-billing',
		name: 'Quotient Billing Studio',
		category: 'Billing & Quotes',
		description:
			'Build quotes, invoices, and flexible plans with tax logic and discounting baked in.',
		shortDescription: 'Quote-to-cash workflows with flexible billing logic.',
		pricing: {
			monthly: 159,
			sixMonth: 840,
			yearly: 1440
		},
		annualLabel: 'Save 25% annually',
		seats: 'Unlimited teammates',
		frequency: 'Billed monthly, biannual, or yearly',
		badges: ['Billing', 'New'],
		variants: ['Standard (core billing)', 'Advanced (tax + discounts)', 'Enterprise (custom)'],
		terms: [
			{ label: 'Discounts', value: 'Flexible rules' },
			{ label: 'Taxes', value: 'Global-ready' },
			{ label: 'Invoice terms', value: 'Net 30' },
			{ label: 'Support', value: 'Dedicated CSM' }
		]
	}
];

export const getSubscriptions = () => subscriptions;

export const getSubscriptionById = (id) =>
	subscriptions.find((subscription) => subscription.id === id);
