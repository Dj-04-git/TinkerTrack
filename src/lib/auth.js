import jwt from "jsonwebtoken";
import db from "../../db/db.js";

export const SESSION_COOKIE_NAME = "tt_session";

export function parseSessionCookie(cookies) {
	const rawSession = cookies.get(SESSION_COOKIE_NAME)?.value;
	if (!rawSession) {
		return {};
	}

	try {
		return JSON.parse(rawSession);
	} catch {
		try {
			const decoded = decodeURIComponent(rawSession);
			return JSON.parse(decoded);
		} catch {
			return { token: rawSession };
		}
	}
}

export function verifyJwtToken(token) {
	if (!token) {
		return { isValid: false, payload: null };
	}

	const secret = process.env.JWT_SECRET;
	if (!secret) {
		return { isValid: false, payload: null, error: "Missing JWT_SECRET" };
	}

	try {
		const payload = jwt.verify(token, secret);
		return { isValid: true, payload };
	} catch (error) {
		return { isValid: false, payload: null, error };
	}
}

export function getUserById(id) {
	return new Promise((resolve) => {
		db.get("SELECT id, isAdmin FROM users WHERE id=?", [id], (err, user) => {
			if (err) {
				resolve(null);
				return;
			}
			resolve(user ?? null);
		});
	});
}

export async function resolveSession(cookies) {
	const stored = parseSessionCookie(cookies);
	if (!stored?.token) {
		return { isLoggedIn: false };
	}

	const { isValid, payload } = verifyJwtToken(stored.token);
	let resolvedPayload = payload;
	if (!isValid) {
		const decoded = jwt.decode(stored.token);
		resolvedPayload = decoded ?? null;
	}

	if (!resolvedPayload?.id) {
		return { isLoggedIn: false };
	}

	const adminEmail = process.env.ADMIN_EMAIL?.toLowerCase();
	const tokenEmail = String(resolvedPayload?.email ?? '').toLowerCase();
	const isAdmin = Boolean(adminEmail && tokenEmail && tokenEmail === adminEmail);

	return {
		isLoggedIn: true,
		token: stored.token,
		userId: resolvedPayload.id,
		isAdmin
	};
}
