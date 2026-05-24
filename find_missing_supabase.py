import glob

files = sorted(glob.glob('*.html'))
missing = []
for f in files:
    text = open(f, 'r', encoding='utf-8').read()
    if "import { supabase } from './supabase.js'" not in text:
        missing.append(f)
print('MISSING', len(missing))
for f in missing:
    print(f)
  