"""Signup-request notification emails. Follows the same convention as
apps.reporting.exports's email step: EMAIL_HOST unset means Django's
console backend logs the message instead of sending it (see
config/settings/base.py) — never a silent no-op, so these are safe to
call before real SMTP credentials exist."""

from django.core.mail import EmailMessage

from .constants import PERM_USERS_MANAGE


def _stakeholder_emails():
    from .models import User

    return list(
        User.objects.filter(
            user_roles__role__permissions__contains=[PERM_USERS_MANAGE],
            is_active=True,
        )
        .exclude(email="")
        .values_list("email", flat=True)
        .distinct()
    )


def send_signup_request_submitted(signup_request):
    """Notifies everyone who can approve it (PERM_USERS_MANAGE holders —
    "admin / admin entrusted person") plus a receipt to the requester."""
    stakeholders = _stakeholder_emails()
    if stakeholders:
        EmailMessage(
            subject=f"New access request — {signup_request.name}",
            body=(
                f"{signup_request.name} <{signup_request.email}> requested access to bpro FieldOps.\n\n"
                f"Requested role: {signup_request.get_requested_role_name_display() or '—'}\n"
                f"Phone: {signup_request.phone or '—'}\n"
                f"Department: {signup_request.department or '—'}\n"
                f"Message: {signup_request.message or '—'}\n\n"
                "Review it in the admin console under Access > Signup Requests."
            ),
            to=stakeholders,
        ).send(fail_silently=False)

    if signup_request.email:
        EmailMessage(
            subject="Your bpro FieldOps access request was received",
            body=(
                f"Hi {signup_request.name},\n\n"
                "Thanks for requesting access to bpro FieldOps. An administrator will review "
                "your request and get in touch once it's been decided.\n\n"
                "— bpro FieldOps"
            ),
            to=[signup_request.email],
        ).send(fail_silently=False)


def send_signup_request_approved(signup_request, set_password_url):
    if not signup_request.email:
        return
    EmailMessage(
        subject="Your bpro FieldOps access request was approved",
        body=(
            f"Hi {signup_request.name},\n\n"
            "Your access request has been approved. Set your password to finish creating your "
            f"account:\n\n{set_password_url}\n\n"
            "This link is one-time use and specific to your account.\n\n"
            "— bpro FieldOps"
        ),
        to=[signup_request.email],
    ).send(fail_silently=False)


def send_signup_request_rejected(signup_request, reason=""):
    if not signup_request.email:
        return
    body = f"Hi {signup_request.name},\n\nYour access request could not be approved at this time."
    if reason:
        body += f"\n\nReason: {reason}"
    body += "\n\n— bpro FieldOps"
    EmailMessage(
        subject="Your bpro FieldOps access request",
        body=body,
        to=[signup_request.email],
    ).send(fail_silently=False)
