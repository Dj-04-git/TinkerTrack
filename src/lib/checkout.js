const cartItems = [
	{
		id: 'pulse-analytics',
		name: 'Pulse Analytics Suite',
		summary: 'Revenue dashboards + churn forecasting',
		price: 120,
		unit: 'per day',
		quantity: 1
	},
	{
		id: 'retention-lab',
		name: 'Retention Lab',
		summary: 'Renewal recovery automations',
		price: 60,
		unit: 'per day',
		quantity: 1
	}
];

const addresses = [
	{
		id: 'primary',
		label: 'Headquarters',
		name: 'Harbor SaaS Studio',
		line1: '78 Market Street',
		line2: 'Suite 12A',
		city: 'San Francisco',
		region: 'CA',
		postalCode: '94105',
		country: 'United States'
	}
];

const orderSummary = {
	subtotal: 1080,
	taxes: 120,
	total: 1200,
	discount: 120,
	discountLabel: '10% off your order'
};

const orderReceipt = {
	orderId: 'S-0001',
	status: 'Payment processed',
	message: 'Your subscription order has been confirmed and the invoice was sent to finance.',
	lineItems: [
		{ name: 'Pulse Analytics Suite', amount: 1200 },
		{ name: '10% off your order', amount: -120 }
	],
	summary: orderSummary
};

const orders = [
	{
		id: 'S-0001',
		date: '06/02/2026',
		total: 1200,
		status: 'Paid',
		subscription: 'Pulse Analytics Suite',
		plan: 'Monthly',
		startDate: '06/02/2026',
		endDate: '07/02/2026',
		billingAddress: {
			name: 'Harbor SaaS Studio',
			line1: '78 Market Street',
			line2: 'Suite 12A',
			city: 'San Francisco',
			region: 'CA',
			postalCode: '94105',
			country: 'United States',
			email: 'billing@harborsaas.io',
			phone: '+1 (415) 555-2841'
		},
		invoices: [
			{
				number: 'INV-3021',
				status: 'Paid',
				amount: 1200,
				invoiceDate: '06/02/2026',
				dueDate: '06/02/2026',
				source: 'Auto-renewal',
				paymentTerm: 'Immediate payment',
				paidOn: '06/02/2026',
				amountDue: 0
			}
		],
		items: [
			{ name: 'Pulse Analytics Suite', quantity: 1, unitPrice: 1200, tax: '15%', amount: 1200 },
			{ name: '10% off your order', quantity: 1, unitPrice: -120, tax: '—', amount: -120 }
		],
		summary: {
			subtotal: 1080,
			taxes: 120,
			total: 1200
		}
	},
	{
		id: 'S-0002',
		date: '06/02/2026',
		total: 1800,
		status: 'Pending',
		subscription: 'Retention Lab',
		plan: '6 months',
		startDate: '06/02/2026',
		endDate: '12/02/2026',
		billingAddress: {
			name: 'Harbor SaaS Studio',
			line1: '78 Market Street',
			line2: 'Suite 12A',
			city: 'San Francisco',
			region: 'CA',
			postalCode: '94105',
			country: 'United States',
			email: 'billing@harborsaas.io',
			phone: '+1 (415) 555-2841'
		},
		invoices: [
			{
				number: 'INV-3048',
				status: 'Awaiting',
				amount: 1800,
				invoiceDate: '06/02/2026',
				dueDate: '06/10/2026',
				source: 'Manual invoice',
				paymentTerm: 'Net 7',
				paidOn: null,
				amountDue: 1800
			}
		],
		items: [
			{ name: 'Retention Lab', quantity: 1, unitPrice: 1800, tax: '15%', amount: 1800 }
		],
		summary: {
			subtotal: 1560,
			taxes: 240,
			total: 1800
		}
	}
];

export const getCartItems = () => cartItems;
export const getOrderSummary = () => orderSummary;
export const getAddresses = () => addresses;
export const getOrderReceipt = () => orderReceipt;
export const getOrders = () => orders;
export const getOrderById = (id) => orders.find((order) => order.id === id);
export const getInvoiceById = (orderId, invoiceId) =>
	getOrderById(orderId)?.invoices.find((invoice) => invoice.number === invoiceId);
