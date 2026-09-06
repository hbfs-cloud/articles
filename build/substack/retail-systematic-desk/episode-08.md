---
title: "Make Freshness a Blocking Field"
subtitle: "Collected now does not mean the underlying market observation is current."
series_id: "retail-systematic-desk"
module_id: "data-health"
module_title: "Make Data Quality Executable"
module_episode: 2
episode_number: 8
scheduled_at: "2026-10-23T12:00:00.000Z"
send_email: false
---
*Part 2 of 3 in Make Data Quality Executable. Lesson 8 of 45 in Build a Retail Systematic Desk, Safely.*

::audience non_sub,free_sub
Each part stands on its own. This is 8 of 45 in Build a Retail Systematic Desk, Safely; earlier parts cover the groundwork but you can start here.
::end

The clock on a response tells you when the answer arrived at your machine. It says nothing about how old the market observation inside it is. Those are different facts, and only the second one matters for a decision. <mark>A file downloaded at seven this morning can easily describe the world as it stood two sessions ago, and the download will look perfectly healthy while it does.</mark>

![Not all dates are known equally far in advance](https://raw.githubusercontent.com/hbfs-cloud/articles/main/substack-assets/schematics/calendar_certainty.png)

**Input from last Friday:** the accepted capability bootstrap report.

**Friday deliverable:** a freshness gate test report, filed with the run's paperwork by whoever runs the desk that week.

## Build this

Name the session you intend to act on before you fetch anything, and pass that name into the request. Get the name from an exchange calendar, never from arithmetic on today's date, because subtracting one day lands you on a holiday sooner or later.

Then store five things per dataset: the close you asked for, the close you were served, whether partial bars (a day still in progress, whose high and low are not final) were allowed in, the market state, and a single yes-or-no freshness verdict. Anything short of the expected session comes back labelled stale or insufficient, and the run does not proceed on it.

Toy run, numbers made up to show the shape: 1,204 rows land, the request named Thursday's close, the file's newest complete close is Tuesday's, and three rows are still open bars. Two sessions behind. Gate says no. Under the old code, that same file went straight into a ranking and produced eleven confident candidates.

## Test it before moving on

Four cases, all of which must be refused except the first: an ordinary weekday with everything complete; a public holiday; a Saturday; and a source that returns a cheerful 200 OK while its data stops several sessions early. That last one is the case that bites in real life.

**Operating limit:** this is a paper exercise on a public timetable. Nothing here is tuned, sized, or connected to a funded account, and none of it is a claim about returns.

For the timetable itself, use [the NYSE hours and calendars page](https://www.nyse.com/trade/hours-calendars), and read [FINRA on extended-hours trading](https://www.finra.org/investors/insights/extended-hours-trading) to see why "the market is open" is a fuzzier statement than it sounds.

Educational, not investment advice.

## Release decision

**GO:** accept the report when all four cases behave and the saved record carries the expected close, the served close, the partial-bar flag, the market state and the verdict.

**NO-GO:** a healthy connection carrying old coverage is a failed input, not a warning to be waved through.

**Next Friday:** the accepted report feeds Preserve Partial Failures in Batches.

> Name the session you meant to trade, and make the file prove it got there.
