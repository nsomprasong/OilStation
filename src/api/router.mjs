// An explicitly injected dependency boundary. Unit tests never access Supabase or secrets.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const IDKEY = /^[a-zA-Z0-9_-]{16,128}$/;
const LIMIT_BYTES = 16_384;
const allowMethods = { '/api/health': 'GET', '/api/me': 'GET', '/api/fuel-catalog': 'GET', '/api/coupons': 'POST', '/api/invitations/accept': 'POST', '/api/my-accounts': 'GET', '/api/bootstrap': 'POST', '/api/fuel-brands': 'GET',
  '/api/platform/stations': 'GET', '/api/platform/create-station': 'POST',
  '/api/station-fuels': 'GET', '/api/station-fuel-config': 'POST',
  '/api/invitations/create': 'POST',
  '/api/station/customers': 'POST', '/api/station/link-company': 'POST',
  '/api/corporate/approve-link': 'POST',
  '/api/corporate/pending-links': 'GET',
  '/api/station/invite-first-admin': 'POST',
  '/api/hr/roster': 'GET', '/api/hr/employees': 'POST',
  '/api/hr/seed-shifts': 'POST', '/api/hr/assign-shift': 'POST' };

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store', 'x-content-type-options': 'nosniff',
      'referrer-policy': 'no-referrer', 'x-frame-options': 'DENY' },
  });
}
function fail(status, code) { return json(status, { error: code }); }
function permittedMember(m) { return m && m.active === true; }
function canIssue(m, companyId) {
  return permittedMember(m) &&
    m.scope_type === 'corporate_company' &&
    m.corporate_company_id === companyId &&
    (['corporate_admin', 'coupon_issuer', 'qr_issuer'].includes(m.role_code) || m.extra_permissions?.issue_coupon === true);
}
function parseCouponInput(data, now, idkey) {
  if (!data || Array.isArray(data) || typeof data !== 'object') return null;
  const { accountId, stationFuelId, amountSatang, expiresAt } = data;
  if (!UUID.test(accountId ?? '') || !UUID.test(stationFuelId ?? '')) return null;
  // The wire contract uses strings to avoid loss of integer precision in JSON.
  if (typeof amountSatang !== 'string' || !/^[1-9][0-9]{0,14}$/.test(amountSatang)) return null;
  if (typeof expiresAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(expiresAt)) return null;
  const exp = Date.parse(expiresAt);
  if (!Number.isFinite(exp) || exp <= now.getTime()) return null;
  if (typeof data.plate !== 'undefined' && (typeof data.plate !== 'string' || data.plate.length > 40)) return null;
  if (!IDKEY.test(idkey ?? '')) return null;
  return { accountId, stationFuelId, amountSatang, expiresAt: new Date(exp).toISOString(),
    plate: data.plate?.trim() || null, idempotencyKey: idkey };
}
async function readBody(request) {
  const header = request.headers.get('content-length');
  if (header && Number(header) > LIMIT_BYTES) return null;
  const reader = request.body?.getReader();
  if (!reader) return null;
  let total = 0;
  const parts = [];
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > LIMIT_BYTES) { await reader.cancel(); return null; }
      parts.push(value);
    }
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const p of parts) { bytes.set(p, offset); offset += p.byteLength; }
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch { return null; } finally { reader.releaseLock(); }
}
export function createApi({ authenticate, db, now = () => new Date() }) {
  return async function handle(request) {
    const url = new URL(request.url);
    const path = url.pathname;
    const fuelPath = /^\/api\/my-accounts\/([0-9a-f-]{36})\/fuels$/i.exec(path);
    if (!(path in allowMethods) && !fuelPath) return fail(404, 'not_found');
    if (request.method !== (fuelPath ? 'GET' : allowMethods[path])) return fail(405, 'method_not_allowed');
    if (path === '/api/health') return json(200, { service: 'oilstation', status: 'ok' });
    if (request.method !== 'GET' && request.headers.get('origin') &&
      request.headers.get('origin') !== url.origin) return fail(403, 'origin_forbidden');
    const header = request.headers.get('authorization') || '';
    const match = /^Bearer\s+([^\s]+)$/i.exec(header);
    if (!match) return fail(401, 'unauthenticated');
    try {
      const user = await authenticate(match[1]);
      if (!user?.id || !UUID.test(user.id)) return fail(401, 'unauthenticated');
      if (path === '/api/bootstrap') {
        return json(200, await db.bootstrapAdmin(user.id));
      }
      if (path === '/api/invitations/accept') {
        if (!(request.headers.get('content-type') || '').toLowerCase().startsWith('application/json')) return fail(415, 'unsupported_media_type');
        const data = await readBody(request);
        if (typeof data?.token !== 'string' || !/^[A-Za-z0-9_-]{32,128}$/.test(data.token)) return fail(400, 'invalid_invitation');
        return json(200, await db.acceptInvitation({ actorId: user.id, token: data.token }));
      }
      const memberships = (await db.memberships(user.id)) || [];
      const active = memberships.filter(permittedMember);
      if (!active.length) return fail(403, 'invitation_required');
      if (path === '/api/me') {
        return json(200, { userId: user.id, memberships: active.map(m => ({
          scopeType: m.scope_type, organizationId: m.organization_id,
          stationId: m.station_id, corporateCompanyId: m.corporate_company_id,
          role: m.role_code,
        })) });
      }
      if (path.startsWith('/api/hr/')) {
        const body = path === '/api/hr/roster' ? null : await readBody(request);
        const stationId = path === '/api/hr/roster'
          ? url.searchParams.get('stationId') : body?.stationId;
        if (!UUID.test(stationId??'')) return fail(400,'invalid_station');
        const canManage = active.some(m=>
          (m.scope_type==='platform' && m.role_code==='platform_superadmin')
          || (m.scope_type==='station' && m.station_id===stationId
            && ['station_owner','owner','manager','hr_manager'].includes(m.role_code))
          || (m.scope_type==='organization'
            && ['organization_owner','owner'].includes(m.role_code)));
        if (!canManage) return fail(403,'permission_denied');
        if (path==='/api/hr/roster') {
          return json(200,{roster:await db.hrRoster({actorId:user.id,stationId})});
        }
        if (!(request.headers.get('content-type')||'').toLowerCase().startsWith('application/json')) {
          return fail(415,'unsupported_media_type');
        }
        if (path==='/api/hr/seed-shifts') {
          return json(200,{result:await db.hrSeedTemplates({actorId:user.id,stationId})});
        }
        if (path==='/api/hr/employees') {
          if(typeof body.employeeCode!=='string' || !/^[a-z0-9_-]{1,40}$/i.test(body.employeeCode)
            || typeof body.name!=='string' || body.name.trim().length<2 || body.name.length>200
            || !['monthly','daily','hourly'].includes(body.wageType)
            || typeof body.wageSatang!=='string'
            || !/^(0|[1-9][0-9]{0,14})$/.test(body.wageSatang)
            || !['weekly','semi_monthly','monthly'].includes(body.payrollFrequency)) {
            return fail(400,'invalid_employee');
          }
          return json(201,{employee:await db.hrAddEmployee({
            actorId:user.id,stationId,employeeCode:body.employeeCode,
            name:body.name.trim(),wageType:body.wageType,wageSatang:body.wageSatang,
            payrollFrequency:body.payrollFrequency,
          })});
        }
        if(path==='/api/hr/assign-shift') {
          if (!UUID.test(body?.employeeId??'') || !UUID.test(body?.templateId??'')
           || typeof body.date!=='string' || !/^\d{4}-\d{2}-\d{2}$/.test(body.date)
           || !Number.isFinite(Date.parse(body.date+'T00:00:00Z'))) {
           return fail(400,'invalid_shift');
          }
          return json(201,{assignment:await db.hrAssignShift({
            actorId:user.id,stationId,employeeId:body.employeeId,
            templateId:body.templateId,date:body.date,
          })});
        }
      }
      if (path === '/api/corporate/pending-links') {
        if (!active.some(m => m.scope_type==='corporate_company' && m.role_code==='corporate_admin')) {
          return fail(403,'permission_denied');
        }
        return json(200,{requests: await db.pendingCorporateLinks(user.id)});
      }
      if (path === '/api/station/invite-first-admin') {
        if (!(request.headers.get('content-type') || '').toLowerCase().startsWith('application/json')) {
          return fail(415,'unsupported_media_type');
        }
        const body = await readBody(request);
        if (!UUID.test(body?.stationId ?? '') || !UUID.test(body?.companyId ?? '')
          || typeof body?.email !== 'string'
          || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(body.email)
          || body.email.length>320) return fail(400,'invalid_invitation');
        const manager = active.some(m=>
          (m.scope_type==='platform' && m.role_code==='platform_superadmin')
          || (m.scope_type==='station' && m.station_id===body.stationId
            && ['station_owner','owner'].includes(m.role_code))
          || (m.scope_type==='organization' && ['organization_owner','owner'].includes(m.role_code)));
        if (!manager) return fail(403,'permission_denied');
        return json(201,{invitation:await db.inviteFirstCorporateAdmin({
          actorId:user.id,stationId:body.stationId,companyId:body.companyId,
          email:body.email.trim().toLowerCase(),
          expiresAt:new Date(now().getTime()+7*86_400_000).toISOString(),
        })});
      }
      if (path === '/api/station/customers' || path === '/api/station/link-company'
        || path === '/api/corporate/approve-link') {
        if (!(request.headers.get('content-type') || '').toLowerCase().startsWith('application/json')) {
          return fail(415, 'unsupported_media_type');
        }
        const body = await readBody(request);
        if (path === '/api/corporate/approve-link') {
          if (!UUID.test(body?.requestId ?? '') || typeof body?.approved !== 'boolean') {
            return fail(400, 'invalid_link_request');
          }
          return json(200, { result: await db.approveCorporateLink({
            actorId:user.id,requestId:body.requestId,approved:body.approved,
          }) });
        }
        if (!UUID.test(body?.stationId ?? '')) return fail(400, 'invalid_station');
        const canManage = active.some(m=>
          (m.scope_type==='platform' && m.role_code==='platform_superadmin')
          || (m.scope_type==='station' && m.station_id===body.stationId
            && (['station_owner','owner','manager'].includes(m.role_code)
              || m.extra_permissions?.manage_corporate_customers===true))
          || (m.scope_type==='organization' && ['organization_owner','owner'].includes(m.role_code)));
        if (!canManage) return fail(403, 'permission_denied');
        if (path === '/api/station/link-company') {
          if (!UUID.test(body?.companyId ?? '')) return fail(400, 'invalid_company');
          return json(201, { result: await db.requestCorporateLink({
            actorId:user.id,stationId:body.stationId,companyId:body.companyId,
          }) });
        }
        const name = body?.name;
        const taxId = body?.taxId || null;
        const contactEmail = body?.contactEmail || null;
        const terms = body?.paymentTermsDays;
        const mode = body?.dueMode;
        const closeDay = body?.statementCloseDay ?? null;
        if (typeof name!=='string' || name.trim().length<2 || name.length>200
          || (taxId!==null && (typeof taxId!=='string' || !/^\d{13}$/.test(taxId)))
          || (contactEmail!==null && (typeof contactEmail!=='string'
             || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(contactEmail)
             || contactEmail.length>320))
          || !Number.isInteger(terms) || terms<0 || terms>365
          || !['per_fill','statement'].includes(mode)
          || (mode==='statement' && (!Number.isInteger(closeDay) || closeDay<1 || closeDay>31))) {
          return fail(400, 'invalid_customer');
        }
        return json(201,{ customer: await db.createCorporateCustomer({
          actorId:user.id,stationId:body.stationId,name:name.trim(),
          taxId,contactEmail,paymentTermsDays:terms,dueMode:mode,
          statementCloseDay:closeDay,
        }) });
      }
      if (path === '/api/invitations/create') {
        if (!(request.headers.get('content-type') || '').toLowerCase().startsWith('application/json')) {
          return fail(415, 'unsupported_media_type');
        }
        const body = await readBody(request);
        const email = body?.email?.trim().toLowerCase();
        const allowedRoles = {
          platform:['platform_sales','platform_support'],
          organization:['organization_owner','organization_manager'],
          station:['station_owner','manager','cashier','pump_staff','attendant'],
          corporate_company:['corporate_admin','coupon_issuer','accountant','finance_manager','driver'],
        };
        if (typeof email !== 'string' || email.length > 320
          || !/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(email)
          || typeof body.roleCode !== 'string'
          || !/^[a-z_]{3,40}$/.test(body.roleCode)
          || !allowedRoles[body.scopeType]?.includes(body.roleCode)
          || (body.scopeType !== 'platform' && !UUID.test(body.scopeId ?? ''))
          || (body.scopeType === 'platform' && body.scopeId)) {
          return fail(400, 'invalid_invitation');
        }
        const expiresAt = new Date(now().getTime() + 7 * 24 * 60 * 60_000).toISOString();
        const invitation = await db.createInvitation({
          actorId:user.id,email,roleCode:body.roleCode,scopeType:body.scopeType,
          scopeId:body.scopeType==='platform'?null:body.scopeId,expiresAt,
        });
        return json(201,{invitation});
      }
      if (path === '/api/fuel-brands') {
        return json(200, { brands: await db.fuelBrands() });
      }
      if (path === '/api/platform/stations' || path === '/api/platform/create-station') {
        const platformAdmin = active.some(m => m.scope_type === 'platform'
          && m.role_code === 'platform_superadmin');
        if (!platformAdmin) return fail(403, 'permission_denied');
        if (path === '/api/platform/stations') {
          return json(200, { stations: await db.platformStations(user.id) });
        }
        if (!(request.headers.get('content-type') || '').toLowerCase().startsWith('application/json')) {
          return fail(415, 'unsupported_media_type');
        }
        const body = await readBody(request);
        if (!body || typeof body.organizationName !== 'string'
          || body.organizationName.trim().length < 2 || body.organizationName.trim().length > 160
          || typeof body.stationName !== 'string'
          || body.stationName.trim().length < 2 || body.stationName.trim().length > 160
          || !/^[A-Z0-9_]{2,40}$/.test(body.brandCode ?? '')
          || typeof body.modules?.qrCoupon !== 'boolean'
          || typeof body.modules?.hrPayroll !== 'boolean'
          || (!body.modules.qrCoupon && !body.modules.hrPayroll)) {
          return fail(400, 'invalid_station');
        }
        return json(201, { station: await db.createStation({
          actorId: user.id, organizationName: body.organizationName.trim(),
          stationName: body.stationName.trim(), brandCode: body.brandCode,
          qrCoupon: body.modules.qrCoupon, hrPayroll: body.modules.hrPayroll,
        }) });
      }
      if (path === '/api/station-fuels' || path === '/api/station-fuel-config') {
        let stationId, fuelId, enabled, publicPrice;
        if (path === '/api/station-fuels') {
          stationId = url.searchParams.get('stationId');
          if (!UUID.test(stationId ?? '')) return fail(400, 'invalid_station');
        } else {
          if (!(request.headers.get('content-type') || '').toLowerCase().startsWith('application/json')) {
            return fail(415, 'unsupported_media_type');
          }
          const data = await readBody(request);
          stationId = data?.stationId; fuelId = data?.stationFuelId;
          enabled = data?.enabled; publicPrice = data?.publicPrice;
          if (!UUID.test(stationId ?? '') || !UUID.test(fuelId ?? '')
            || typeof enabled !== 'boolean'
            || typeof publicPrice !== 'string'
            || !/^[0-9]{1,8}(?:\.[0-9]{1,4})?$/.test(publicPrice)
            || Number(publicPrice)<=0) return fail(400, 'invalid_fuel_price');
        }
        const canManage = active.some(m =>
          (m.scope_type === 'platform' && m.role_code === 'platform_superadmin')
          || (m.scope_type === 'station' && m.station_id === stationId
            && (['station_owner','owner','manager'].includes(m.role_code)
              || m.extra_permissions?.manage_fuel_prices === true))
          || (m.scope_type === 'organization'
            && ['organization_owner','owner'].includes(m.role_code)));
        if (!canManage) return fail(403, 'permission_denied');
        if (path === '/api/station-fuels') {
          return json(200, { fuels: await db.stationFuels(user.id, stationId) });
        }
        return json(200, { fuel: await db.configureFuel({
          actorId:user.id, stationId, stationFuelId:fuelId, enabled, publicPrice,
        }) });
      }
      if (path === '/api/my-accounts') {
        return json(200, { accounts: await db.corporateAccounts(user.id) });
      }
      if (fuelPath) {
        const accountId = fuelPath[1];
        if (!UUID.test(accountId)) return fail(404, 'not_found');
        const account = await db.account(accountId);
        if (!account) return fail(404, 'account_not_found');
        if (!active.some(m => canIssue(m, account.company_id))) return fail(403, 'permission_denied');
        return json(200, { fuels: await db.accountFuels(user.id, accountId) });
      }
      if (path === '/api/fuel-catalog') {
        const brand = url.searchParams.get('brand');
        if (!brand || !/^[A-Z0-9_]{2,40}$/.test(brand)) return fail(400, 'invalid_brand');
        return json(200, { products: await db.fuelCatalog(brand) });
      }
      if (path === '/api/coupons') {
        if (!(request.headers.get('content-type') || '').toLowerCase().startsWith('application/json')) return fail(415, 'unsupported_media_type');
        const body = await readBody(request);
        const input = parseCouponInput(body, now(), request.headers.get('idempotency-key'));
        if (!input) return fail(400, 'invalid_coupon_request');
        const account = await db.account(input.accountId);
        if (!account) return fail(404, 'account_not_found');
        if (!active.some(m => canIssue(m, account.company_id))) return fail(403, 'permission_denied');
        const result = await db.issueCoupon({ ...input, actorId: user.id, stationId: account.station_id });
        return json(result.replayed ? 200 : 201, { coupon: result });
      }
      return fail(404, 'not_found');
    } catch (error) {
      // Do not leak SQL details, bank/account references, keys, or stack traces.
      if (error && typeof error === 'object' && error.code === 'INSUFFICIENT_FUNDS') return fail(409, 'insufficient_funds');
      if (error && typeof error === 'object' && error.code === 'FORBIDDEN') return fail(403, 'permission_denied');
      if (error && typeof error === 'object' && error.code === 'INVALID_REQUEST') return fail(400, 'invalid_coupon_request');
      if (error && typeof error === 'object' && error.code === 'INVITE_INVALID') return fail(400, 'invalid_or_expired_invitation');
      if (error && typeof error === 'object' && error.code === 'EMAIL_MISMATCH') return fail(403, 'invited_email_verification_required');
      if (error && typeof error === 'object' && error.code === 'BOOTSTRAP_FORBIDDEN') return fail(403, 'bootstrap_not_allowed');
      if (error && typeof error === 'object' && error.code === 'ALREADY_BOOTSTRAPPED') return fail(409, 'already_bootstrapped');
      return fail(503, 'service_unavailable');
    }
  };
}
