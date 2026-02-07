import { resolveSession } from './lib/auth.js';

export async function onRequest({ locals, cookies }, next) {
	locals.session = await resolveSession(cookies);
	return next();
}
