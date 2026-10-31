# Sales operational drilldown + activity log — review and human UAT

## Navigating
1. Sales logs in and opens **งานขายของฉัน**. Platform Admin opens **ทีมขายและค่าคอมมิชชั่น**.
2. Each **current** assigned station has an **เปิดหน้าปั๊ม** action. A salesperson cannot inspect upcoming/historic/other stations. Platform Admin may inspect any registered station.
3. From the station detail, use **ดูข้อมูลลูกค้า** to inspect each company currently linked to that station. Read-only detail shows company status and registered vehicles; not balances, invoices, payments or financial controls.
4. **ย้อนกลับ** returns to that station's company list.
5. Select **ประวัติการดำเนินการ** from Home or the related navigation above. Choose an authorized station. The compact table has exactly **ใคร**, **ทำอะไร**, **เมื่อไร**. Repeated rows show no JSON diffs, old/new values or financial details.
6. **ดูรายการก่อนหน้า** is shown when a page is full (50 rows); refresh reloads latest data.

## Security acceptance
- SQL performs independent active platform role checks and requires a **currently effective** sales assignment for the exact station. Future and expired assignments do not grant operational inspection access.
- A company ID is checked against the station's actual corporate_station_accounts relation; a direct link to another company must be denied.
- Activity scope applies the same station permission check and filters to a fixed operational event whitelist. Only actor display name, safe Thai action, timestamp and non-sensitive event ID are emitted. No financial fields or JSON before_state/after_state are returned.
- No impersonation/customer login takeover; all views read-only and no financial write API.
- APIs reject bad station/company UUIDs, unknown/duplicate parameters, malformed date cursor, wrong methods, and missing authorization.
- SQL RPCs are private to service_role. Browser communicates through authorized Cloudflare Worker only.
- This migration is additive: no customer, invoice, commission, or audit records are created or modified.

## Deployment sequence
1. Verify exact PR-head CI including Node, build and isolated SQL parity.
2. Apply only reviewed `20261031140000_sales_operational_readonly.sql` and confirm both RPC grants.
3. Merge PR to main, deploy guarded Worker and frontend, smoke-check website and API.
4. Verify Cloudflare `OILSTATION_API_ENABLED=false` remains unchanged (money operations disabled).
5. Human UAT with invited Sales user + Platform Admin, station A vs station B, company A vs B, mobile Chrome, Desktop and compact history. CI is not evidence that real-person UAT passed.

No changes to existing email invitation provider.
