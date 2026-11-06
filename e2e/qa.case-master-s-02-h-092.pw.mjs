import {masterCase,STATION_S02B} from '../scripts/qa/master-six-harness.mjs';
// OILSTATION_QA_BATCH_RUN guard is implemented in the shared helper.
const MASTER_UAT_ID='S-02-H';
masterCase({id:MASTER_UAT_ID,description:'station-owner-role-safe-invitation-workflow-ui',alias:'s02b-owner',role:'station_owner',scopeType:'station',scopeId:STATION_S02B,
 check:async({page,auth,headers,expect,BASE})=>{
await page.locator('[data-ws-screen="overview"] [data-ws-go="invitations"]:visible').first().click();
await expect(page.locator('[data-ws-screen="invitations"]:visible')).toBeVisible();
// Current member UI is list-first: the invitation form stays mounted in a
// native Add Member modal and the legacy toggle is deliberately hidden.
const create=page.locator('#member-invites .os-member-create');
await expect(create).toBeVisible({timeout:18000});await create.click();
const dialog=page.locator('#member-invites .os-member-drawer[open]');
await expect(dialog).toBeVisible();
await expect(dialog.locator('#os-member-tab-invite')).toHaveAttribute('aria-selected','true');
const form=dialog.locator('.invite-control form.invite-form');
await expect(form).toBeVisible();
await expect(form.locator('input[type="email"]')).toBeFocused();
const options=await form.locator('select[aria-label="สิทธิ์ที่จะเชิญ"] option').evaluateAll(els=>els.map(x=>x.value));
expect(options).toEqual(['manager','cashier','attendant','pump_staff','hr_manager','finance_manager']);
expect(options).not.toContain('station_owner');expect(options).not.toContain('platform_superadmin');
expect(options).not.toContain('corporate_admin');
await dialog.locator('[aria-label="ปิดหน้าต่างเพิ่มสมาชิก"]').click();await expect(dialog).not.toBeVisible();
const me=await page.request.get(BASE+'/api/me',{headers});expect(me.status()).toBe(200);
expect((await me.json()).memberships[0].stationId).toBe(STATION_S02B);
console.log('MASTER_CASE S-02-H STATION_OWNER_ALLOWED_STAFF_ROLE_CHOICES_AND_SAFE_INVITE_FORM_PASS; no invitation issued');
}});
