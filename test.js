var _ = require('underscore');

var busy = [ { start: '2017-07-20T00:00:00Z', end: '2017-07-20T00:00:00Z' },
   { start: '2017-07-20T01:00:00Z', end: '2017-07-20T01:00:00Z' },
   { start: '2017-07-20T02:00:00Z', end: '2017-07-20T02:00:00Z' },
   { start: '2017-07-20T04:00:00Z', end: '2017-07-20T04:00:00Z' },
   { start: '2017-07-20T19:00:00Z', end: '2017-07-20T20:00:00Z' },
   { start: '2017-07-21T00:30:00Z', end: '2017-07-21T02:00:00Z' },
   { start: '2017-07-20T00:00:00Z', end: '2017-07-20T01:00:00Z' },
   { start: '2017-07-20T17:00:00Z', end: '2017-07-20T18:00:00Z' },
   { start: '2017-07-21T00:00:00Z', end: '2017-07-21T01:00:00Z' },
   { start: '2017-07-21T03:00:00Z', end: '2017-07-21T04:00:00Z' },
   { start: '2017-07-21T17:30:00Z', end: '2017-07-21T17:55:00Z' },
   { start: '2017-07-21T21:30:00Z', end: '2017-07-21T22:30:00Z' },
   { start: '2017-07-21T23:30:00Z', end: '2017-07-22T00:30:00Z' },
   { start: '2017-07-22T03:00:00Z', end: '2017-07-22T04:00:00Z' },
   { start: '2017-07-19T21:30:00Z', end: '2017-07-19T22:30:00Z' },
   { start: '2017-07-20T07:00:00Z', end: '2017-07-21T07:00:00Z' },
   { start: '2017-07-21T19:00:00Z', end: '2017-07-21T19:25:00Z' },
   { start: '2017-07-21T21:00:00Z', end: '2017-07-21T22:00:00Z' } ]

// calculateFreeTimes(busy);
findFreeTimes(busy, '2017-07-19T21:30:00Z', '2017-07-21T22:00:00Z');

function reduceTimeIntervals(busyArray){
    var intervalStack = [];
    //sort the intervals based on increasing order of starting time
    var sortedIntervals = _.sortBy(busyArray, 'start');
    intervalStack.push(sortedIntervals[0]); //push the first interval on stack
    sortedIntervals.forEach( (interval) => {
        var stackTop = intervalStack[intervalStack.length - 1];
        //If the current interval overlaps with stack top and ending
        //        time of current interval is more than that of stack top,
        //        update stack top with the ending  time of current interval.
        if((Date.parse(interval.start) <= Date.parse(stackTop.start)&& Date.parse(interval.end) > Date.parse(stackTop.start)) || (Date.parse(interval.start) >= Date.parse(stackTop.start) && Date.parse(interval.start) <= Date.parse(stackTop.end))){
            if(Date.parse(interval.end) > Date.parse(stackTop.end)){
                var modifiedStackTop = Object.assign({}, intervalStack.pop(), {end: interval.end})
                intervalStack.push(modifiedStackTop);
            }
        } else {
            //if for some reason the busy interval has same start and end time, dont add it
            if(Date.parse(interval.start) !== Date.parse(interval.end)){
                intervalStack.push(interval);
            }

        }
    })
    return intervalStack;
}

function findFreeTimes(busyArray, meetingStartDate, sevenBusinessDays){
    //meetingStartDate and sevenBusinessDays must be in format '2017-07-22T23:59:59Z'
    var intervals = reduceTimeIntervals(busyArray);
    var freeStart = meetingStartDate.slice(0,11)+'00:00:00Z'
    var freeEnd = sevenBusinessDays.slice(0,11)+'23:59:59Z'
    var freeStack = []
    intervals.forEach((interval) => {
        freeStack.push({start: freeStart, end: interval.start})
        freeStart = interval.end;
    })
    freeStack.push({start: freeStart, end: freeEnd})
    return freeStack;
}
