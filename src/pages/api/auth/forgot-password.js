export const prerender = false;

export async function POST({ request }) {
	try {
		const body = await request.json();
		
		const response = await fetch('http://localhost:3000/auth/forgot-password', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body),
		});

		const text = await response.text();
		let data;
		try {
			data = JSON.parse(text);
		} catch {
			data = { error: text || 'Unknown error from server' };
		}
		
		return new Response(JSON.stringify(data), {
			status: response.status,
			headers: { 'Content-Type': 'application/json' },
		});
	} catch (error) {
		console.error('Forgot password API error:', error);
		return new Response(JSON.stringify({ error: 'Failed to connect to server. Make sure the backend is running.' }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' },
		});
	}
}
