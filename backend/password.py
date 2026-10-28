"""Generate a local password hash without printing or storing the password."""
import getpass
import hashlib
import secrets

password = getpass.getpass('Nuova password archivio: ')
if len(password) < 12:
    raise SystemExit('Usare almeno 12 caratteri.')
if password != getpass.getpass('Ripeti password: '):
    raise SystemExit('Le password non coincidono.')
salt = secrets.token_bytes(16)
digest = hashlib.scrypt(password.encode(), salt=salt, n=16384, r=8, p=1)
print('CLINICAL_PASSWORD_HASH=' + salt.hex() + ':' + digest.hex())
