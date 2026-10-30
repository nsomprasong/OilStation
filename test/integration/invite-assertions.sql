-- No production records, persistent member grants or external email calls.
BEGIN;
DO $check$
DECLARE actor uuid:='11111111-1111-4111-8111-111111111111';
 other_actor uuid:='22222222-2222-4222-8222-222222222222';
 matched_actor uuid:='33333333-3333-4333-8333-333333333333';
 noemail_actor uuid:='44444444-4444-4444-8444-444444444444';
 d jsonb;failed boolean;i integer;
BEGIN
 IF has_function_privilege('anon',
 'public.begin_invited_email_otp(uuid,text,text,timestamp with time zone)','EXECUTE')
 OR has_function_privilege('authenticated',
 'public.confirm_invited_email_otp(uuid,text,text)','EXECUTE')
 THEN RAISE EXCEPTION 'invited_otp_exposed_directly_to_browser';END IF;
 failed:=false;
 BEGIN PERFORM public.accept_member_invitation(actor,repeat('a',64));
 EXCEPTION WHEN OTHERS THEN failed:=SQLERRM='INVITED_EMAIL_MISMATCH';END;
 IF NOT failed THEN RAISE EXCEPTION 'facebook_mismatch_auto_accepted';END IF;
 IF EXISTS(SELECT 1 FROM public.memberships)
 THEN RAISE EXCEPTION 'role_granted_without_proof';END IF;

 d:=public.begin_invited_email_otp(actor,repeat('a',64),
   repeat('1',64),clock_timestamp()+interval '10 minutes');
 IF d->>'email'<>'invited@example.com' THEN
  RAISE EXCEPTION 'otp_destination_not_invitation_mailbox';END IF;
 -- A different authenticated actor cannot use the same hashed proof.
 d:=public.confirm_invited_email_otp(other_actor,repeat('a',64),repeat('1',64));
 IF d->>'accepted'<>'false' THEN RAISE EXCEPTION 'otp_account_not_bound';END IF;
 FOR i IN 1..5 LOOP
  d:=public.confirm_invited_email_otp(actor,repeat('a',64),repeat('f',64));
  IF d->>'accepted'<>'false' THEN RAISE EXCEPTION 'incorrect_otp_accepted';END IF;
 END LOOP;
 IF (SELECT attempts FROM public.invited_email_otp
  WHERE actor_id=actor AND consumed_at IS NULL)<>5
 THEN RAISE EXCEPTION 'otp_attempt_limit_not_persisted';END IF;
 d:=public.confirm_invited_email_otp(actor,repeat('a',64),repeat('1',64));
 IF d->>'accepted'<>'false' THEN RAISE EXCEPTION 'locked_otp_accepted';END IF;
 IF EXISTS(SELECT 1 FROM public.memberships)
 THEN RAISE EXCEPTION 'failed_otp_granted_role';END IF;

 -- A fresh OTP replaces the locked previous code while staying subject to
 -- a strict three-challenges-per-hour issuance cap.
 d:=public.begin_invited_email_otp(actor,repeat('a',64),
   repeat('2',64),clock_timestamp()+interval '10 minutes');
 IF (SELECT count(*) FROM public.invited_email_otp
  WHERE actor_id=actor AND consumed_at IS NULL)<>1
 THEN RAISE EXCEPTION 'old_challenge_not_invalidated';END IF;
 d:=public.confirm_invited_email_otp(actor,repeat('a',64),repeat('1',64));
 IF d->>'accepted'<>'false' THEN RAISE EXCEPTION 'old_challenge_reused';END IF;
 d:=public.confirm_invited_email_otp(actor,repeat('a',64),repeat('2',64));
 IF d->>'accepted'<>'true'
  OR (SELECT count(*) FROM public.memberships WHERE user_id=actor)<>1
  OR (SELECT accepted_at FROM public.invitations
      WHERE token_hash=repeat('a',64)) IS NULL
 THEN RAISE EXCEPTION 'confirmed_invited_email_did_not_grant_once';END IF;
 failed:=false;
 BEGIN PERFORM public.confirm_invited_email_otp(actor,repeat('a',64),repeat('2',64));
 EXCEPTION WHEN OTHERS THEN failed:=SQLERRM='INVITE_INVALID_OR_EXPIRED';END;
 IF NOT failed THEN RAISE EXCEPTION 'consumed_invitation_replayed';END IF;

 -- Confirmed matching emails can accept without requesting any OTP.
 d:=public.accept_member_invitation(matched_actor,repeat('b',64));
 IF d->>'accepted'<>'true' THEN RAISE EXCEPTION 'confirmed_same_email_rejected';END IF;

 -- No email provided by Facebook: OTP mailbox proof still allows verified
 -- invitation even when the provider does not expose a primary email.
 d:=public.begin_invited_email_otp(noemail_actor,repeat('c',64),
   repeat('3',64),clock_timestamp()+interval '10 minutes');
 d:=public.confirm_invited_email_otp(noemail_actor,repeat('c',64),repeat('3',64));
 IF d->>'accepted'<>'true' OR
  (SELECT email FROM public.app_users WHERE id=noemail_actor)<>'noemail-invite@example.com'
 THEN RAISE EXCEPTION 'facebook_missing_email_proof_broken';END IF;
 IF (SELECT count(*) FROM public.memberships)<>3
 THEN RAISE EXCEPTION 'unexpected_number_of_memberships';END IF;
 -- Combined rate limit for one mailbox applies ACROSS distinct OAuth users,
 -- not just three attempts per each separate social account.
 FOR i IN 1..3 LOOP
  PERFORM public.begin_invited_email_otp(actor,repeat('d',64),
   repeat('a',64),clock_timestamp()+interval '10 minutes');
  PERFORM public.begin_invited_email_otp(other_actor,repeat('d',64),
   repeat('b',64),clock_timestamp()+interval '10 minutes');
 END LOOP;
 failed:=false;
 BEGIN
  PERFORM public.begin_invited_email_otp(other_actor,repeat('d',64),
   repeat('f',64),clock_timestamp()+interval '10 minutes');
 EXCEPTION WHEN OTHERS THEN failed:=SQLERRM='RATE_LIMITED';END;
 IF NOT failed THEN RAISE EXCEPTION 'shared_invitation_mailbox_rate_limit_missing';END IF;
 IF (SELECT count(*) FROM public.invited_email_otp WHERE invitation_id=
   'dddddddd-dddd-4ddd-8ddd-dddddddddddd')<>6
 THEN RAISE EXCEPTION 'blocked_otp_request_wrote_record';END IF;
END $check$;
ROLLBACK;
