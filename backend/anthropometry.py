"""Validated current profile and dated evaluation snapshots; no implicit migrations."""
from datetime import date, datetime, timezone
import math

DDL = (
    '''CREATE TABLE Profilo_Antropometrico (
        ID_Paziente INTEGER PRIMARY KEY REFERENCES Pazienti(ID_Paziente) ON DELETE RESTRICT,
        Peso_Kg REAL CHECK(Peso_Kg IS NULL OR Peso_Kg BETWEEN 0.3 AND 500),
        Altezza_Cm REAL CHECK(Altezza_Cm IS NULL OR Altezza_Cm BETWEEN 20 AND 260),
        Data_Misurazione TEXT NOT NULL,
        ID_Valutazione_Origine INTEGER REFERENCES Valutazioni_Posturali(ID_Valutazione) ON DELETE RESTRICT,
        Aggiornato_Il TEXT NOT NULL
    )''',
    '''CREATE TABLE Antropometria_Valutazioni (
        ID_Valutazione INTEGER PRIMARY KEY REFERENCES Valutazioni_Posturali(ID_Valutazione) ON DELETE RESTRICT,
        Peso_Kg REAL CHECK(Peso_Kg IS NULL OR Peso_Kg BETWEEN 0.3 AND 500),
        Altezza_Cm REAL CHECK(Altezza_Cm IS NULL OR Altezza_Cm BETWEEN 20 AND 260),
        Data_Misurazione TEXT NOT NULL,
        Eta_Anni INTEGER CHECK(Eta_Anni IS NULL OR Eta_Anni BETWEEN 0 AND 120),
        Sesso TEXT NOT NULL DEFAULT '' CHECK(Sesso IN ('', 'M', 'F', 'altro'))
    )''',
)


def ready(c):
    tables = {r[0] for r in c.execute("SELECT name FROM sqlite_master WHERE type='table'")}
    if not {'Profilo_Antropometrico', 'Antropometria_Valutazioni'} <= tables:
        return False
    required = {'Profilo_Antropometrico': {'ID_Paziente', 'Peso_Kg', 'Altezza_Cm', 'Data_Misurazione', 'ID_Valutazione_Origine', 'Aggiornato_Il'}, 'Antropometria_Valutazioni': {'ID_Valutazione', 'Peso_Kg', 'Altezza_Cm', 'Data_Misurazione', 'Eta_Anni', 'Sesso'}}
    return all(columns <= {r[1] for r in c.execute('PRAGMA table_info('+table+')')} for table, columns in required.items())


def number(value, lower, upper, label):
    if value is None or value == '':
        return None
    if isinstance(value, bool):
        raise ValueError(label + ' non valido.')
    if isinstance(value, str):
        value = value.strip().replace(',', '.')
        import re
        if not re.fullmatch(r'\d+(?:\.\d+)?', value):
            raise ValueError(label + ' non valido.')
    value = float(value)
    if not math.isfinite(value) or not lower <= value <= upper:
        raise ValueError(label + ' fuori intervallo plausibile.')
    return value


def snapshot(patient):
    data = patient.get('antropometria') or {}
    weight = number(data.get('pesoKg'), 0.3, 500, 'Peso')
    height = number(data.get('altezzaCm'), 20, 260, 'Altezza')
    age = number(patient.get('eta'), 0, 120, 'Età')
    if age is not None and not age.is_integer():
        raise ValueError('Età non valida.')
    measured = patient.get('dataValutazione') or date.today().isoformat()
    if date.fromisoformat(measured).isoformat() != measured:
        raise ValueError('Data misurazione non valida.')
    sex = patient.get('sesso') or ''
    if sex not in ('', 'M', 'F', 'altro'):
        raise ValueError('Sesso non valido.')
    return {'pesoKg': weight, 'altezzaCm': height, 'dataMisurazione': measured, 'etaAnni': int(age) if age is not None else None, 'sesso': sex}


def bmi(data):
    w, h = data.get('pesoKg'), data.get('altezzaCm')
    return w / ((h / 100) ** 2) if w is not None and h is not None else None


def profile(c, pid):
    if not ready(c):
        return None
    row = c.execute('SELECT Peso_Kg, Altezza_Cm, Data_Misurazione, Aggiornato_Il FROM Profilo_Antropometrico WHERE ID_Paziente=?', (pid,)).fetchone()
    if not row:
        return None
    return {'pesoKg': row[0], 'altezzaCm': row[1], 'dataMisurazione': row[2], 'aggiornatoIl': row[3]}


def write_profile(c, pid, data, eid=None):
    now = datetime.now(timezone.utc).isoformat()
    # Older evaluations and an unrelated historical edit must never replace a newer profile.
    c.execute('''INSERT INTO Profilo_Antropometrico
        (ID_Paziente,Peso_Kg,Altezza_Cm,Data_Misurazione,ID_Valutazione_Origine,Aggiornato_Il)
        VALUES (?,?,?,?,?,?) ON CONFLICT(ID_Paziente) DO UPDATE SET
        Peso_Kg=excluded.Peso_Kg, Altezza_Cm=excluded.Altezza_Cm,
        Data_Misurazione=excluded.Data_Misurazione,
        ID_Valutazione_Origine=excluded.ID_Valutazione_Origine, Aggiornato_Il=excluded.Aggiornato_Il
        WHERE excluded.Data_Misurazione > Profilo_Antropometrico.Data_Misurazione
        OR (excluded.Data_Misurazione = Profilo_Antropometrico.Data_Misurazione AND
        (excluded.ID_Valutazione_Origine IS NULL OR
        excluded.ID_Valutazione_Origine >= coalesce(Profilo_Antropometrico.ID_Valutazione_Origine,0)))''',
        (pid, data['pesoKg'], data['altezzaCm'], data['dataMisurazione'], eid, now))


def write_snapshot(c, pid, eid, data, update_profile=True):
    c.execute('''INSERT INTO Antropometria_Valutazioni
        (ID_Valutazione,Peso_Kg,Altezza_Cm,Data_Misurazione,Eta_Anni,Sesso) VALUES (?,?,?,?,?,?)
        ON CONFLICT(ID_Valutazione) DO UPDATE SET Peso_Kg=excluded.Peso_Kg,
        Altezza_Cm=excluded.Altezza_Cm,Data_Misurazione=excluded.Data_Misurazione,
        Eta_Anni=excluded.Eta_Anni,Sesso=excluded.Sesso''',
        (eid, data['pesoKg'], data['altezzaCm'], data['dataMisurazione'], data['etaAnni'], data['sesso']))
    # Explicit clearing is allowed; legacy evaluations with no measurements do not clear the profile.
    if update_profile:
        write_profile(c, pid, data, eid)


def load_snapshot(c, eid):
    if not ready(c):
        return None
    row = c.execute('SELECT Peso_Kg,Altezza_Cm,Data_Misurazione,Eta_Anni,Sesso FROM Antropometria_Valutazioni WHERE ID_Valutazione=?', (eid,)).fetchone()
    if not row:
        return None
    return dict(zip(('pesoKg', 'altezzaCm', 'dataMisurazione', 'etaAnni', 'sesso'), row))
