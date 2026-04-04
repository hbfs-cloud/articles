import datetime
today = datetime.date.today()
dow = today.weekday()
print("Today:", today, "dow:", dow)
if dow == 4:  # Friday
    delta = 3
elif dow == 5:  # Saturday
    delta = 2
elif dow == 6:  # Sunday
    delta = 1
else:
    delta = 1
scan_date = (today + datetime.timedelta(days=delta)).strftime('%Y%m%d')
print("Scan date (next session):", scan_date)
