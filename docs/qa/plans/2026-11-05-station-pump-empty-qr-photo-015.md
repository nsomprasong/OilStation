# OS-QA-ST-PUMP-EMPTY-QR-AND-PHOTO-FIELDS-015

- Actor one existing QA cashier `s01b-cashier`, station `76388e2c-ef36-4656-808b-7d0fbd1d2c35`, 390×844 mobile; protected review secret only.
- Home → Pump screen. Require QR field and camera control. Click Scan with empty QR; browser native required validation must prevent a request; coupon inspection stays closed.
- Inspect actual already rendered evidence inputs: plate photo, meter photo and receipt photo each type=file, required and JPEG/PNG only; camera capture environment. No files actually uploaded, no camera opened.
- Track all OilStation API mutating requests and require none. No QR inspection, approval, fuel start, receipt upload, credit balance or real finances.
- Protected serial workflow only new spec after matching guarded Preview; no past cases repeated.
- Pre-baseline: memberships 100, s01b 7, audit 260, payroll runs 0; compare after if successful.
