var app = angular.module('reportingApp', []);

//<editor-fold desc="global helpers">

var isValueAnArray = function (val) {
    return Array.isArray(val);
};

var getSpec = function (str) {
    var describes = str.split('|');
    return describes[describes.length - 1];
};
var checkIfShouldDisplaySpecName = function (prevItem, item) {
    if (!prevItem) {
        item.displaySpecName = true;
    } else if (getSpec(item.description) !== getSpec(prevItem.description)) {
        item.displaySpecName = true;
    }
};

var getParent = function (str) {
    var arr = str.split('|');
    str = "";
    for (var i = arr.length - 2; i > 0; i--) {
        str += arr[i] + " > ";
    }
    return str.slice(0, -3);
};

var getShortDescription = function (str) {
    return str.split('|')[0];
};

var countLogMessages = function (item) {
    if ((!item.logWarnings || !item.logErrors) && item.browserLogs && item.browserLogs.length > 0) {
        item.logWarnings = 0;
        item.logErrors = 0;
        for (var logNumber = 0; logNumber < item.browserLogs.length; logNumber++) {
            var logEntry = item.browserLogs[logNumber];
            if (logEntry.level === 'SEVERE') {
                item.logErrors++;
            }
            if (logEntry.level === 'WARNING') {
                item.logWarnings++;
            }
        }
    }
};

var convertTimestamp = function (timestamp) {
    var d = new Date(timestamp),
        yyyy = d.getFullYear(),
        mm = ('0' + (d.getMonth() + 1)).slice(-2),
        dd = ('0' + d.getDate()).slice(-2),
        hh = d.getHours(),
        h = hh,
        min = ('0' + d.getMinutes()).slice(-2),
        ampm = 'AM',
        time;

    if (hh > 12) {
        h = hh - 12;
        ampm = 'PM';
    } else if (hh === 12) {
        h = 12;
        ampm = 'PM';
    } else if (hh === 0) {
        h = 12;
    }

    // ie: 2013-02-18, 8:35 AM
    time = yyyy + '-' + mm + '-' + dd + ', ' + h + ':' + min + ' ' + ampm;

    return time;
};

var defaultSortFunction = function sortFunction(a, b) {
    if (a.sessionId < b.sessionId) {
        return -1;
    } else if (a.sessionId > b.sessionId) {
        return 1;
    }

    if (a.timestamp < b.timestamp) {
        return -1;
    } else if (a.timestamp > b.timestamp) {
        return 1;
    }

    return 0;
};

//</editor-fold>

app.controller('ScreenshotReportController', ['$scope', '$http', 'TitleService', function ($scope, $http, titleService) {
    var that = this;
    var clientDefaults = {};

    $scope.searchSettings = Object.assign({
        description: '',
        allselected: true,
        passed: true,
        failed: true,
        pending: true,
        withLog: true
    }, clientDefaults.searchSettings || {}); // enable customisation of search settings on first page hit

    this.warningTime = 1400;
    this.dangerTime = 1900;
    this.totalDurationFormat = clientDefaults.totalDurationFormat;
    this.showTotalDurationIn = clientDefaults.showTotalDurationIn;

    var initialColumnSettings = clientDefaults.columnSettings; // enable customisation of visible columns on first page hit
    if (initialColumnSettings) {
        if (initialColumnSettings.displayTime !== undefined) {
            // initial settings have be inverted because the html bindings are inverted (e.g. !ctrl.displayTime)
            this.displayTime = !initialColumnSettings.displayTime;
        }
        if (initialColumnSettings.displayBrowser !== undefined) {
            this.displayBrowser = !initialColumnSettings.displayBrowser; // same as above
        }
        if (initialColumnSettings.displaySessionId !== undefined) {
            this.displaySessionId = !initialColumnSettings.displaySessionId; // same as above
        }
        if (initialColumnSettings.displayOS !== undefined) {
            this.displayOS = !initialColumnSettings.displayOS; // same as above
        }
        if (initialColumnSettings.inlineScreenshots !== undefined) {
            this.inlineScreenshots = initialColumnSettings.inlineScreenshots; // this setting does not have to be inverted
        } else {
            this.inlineScreenshots = false;
        }
        if (initialColumnSettings.warningTime) {
            this.warningTime = initialColumnSettings.warningTime;
        }
        if (initialColumnSettings.dangerTime) {
            this.dangerTime = initialColumnSettings.dangerTime;
        }
    }


    this.chooseAllTypes = function () {
        var value = true;
        $scope.searchSettings.allselected = !$scope.searchSettings.allselected;
        if (!$scope.searchSettings.allselected) {
            value = false;
        }

        $scope.searchSettings.passed = value;
        $scope.searchSettings.failed = value;
        $scope.searchSettings.pending = value;
        $scope.searchSettings.withLog = value;
    };

    this.isValueAnArray = function (val) {
        return isValueAnArray(val);
    };

    this.getParent = function (str) {
        return getParent(str);
    };

    this.getSpec = function (str) {
        return getSpec(str);
    };

    this.getShortDescription = function (str) {
        return getShortDescription(str);
    };
    this.hasNextScreenshot = function (index) {
        var old = index;
        return old !== this.getNextScreenshotIdx(index);
    };

    this.hasPreviousScreenshot = function (index) {
        var old = index;
        return old !== this.getPreviousScreenshotIdx(index);
    };
    this.getNextScreenshotIdx = function (index) {
        var next = index;
        var hit = false;
        while (next + 2 < this.results.length) {
            next++;
            if (this.results[next].screenShotFile && !this.results[next].pending) {
                hit = true;
                break;
            }
        }
        return hit ? next : index;
    };

    this.getPreviousScreenshotIdx = function (index) {
        var prev = index;
        var hit = false;
        while (prev > 0) {
            prev--;
            if (this.results[prev].screenShotFile && !this.results[prev].pending) {
                hit = true;
                break;
            }
        }
        return hit ? prev : index;
    };

    this.convertTimestamp = convertTimestamp;


    this.round = function (number, roundVal) {
        return (parseFloat(number) / 1000).toFixed(roundVal);
    };


    this.passCount = function () {
        var passCount = 0;
        for (var i in this.results) {
            var result = this.results[i];
            if (result.passed) {
                passCount++;
            }
        }
        return passCount;
    };


    this.pendingCount = function () {
        var pendingCount = 0;
        for (var i in this.results) {
            var result = this.results[i];
            if (result.pending) {
                pendingCount++;
            }
        }
        return pendingCount;
    };

    this.failCount = function () {
        var failCount = 0;
        for (var i in this.results) {
            var result = this.results[i];
            if (!result.passed && !result.pending) {
                failCount++;
            }
        }
        return failCount;
    };

    this.totalDuration = function () {
        var sum = 0;
        for (var i in this.results) {
            var result = this.results[i];
            if (result.duration) {
                sum += result.duration;
            }
        }
        return sum;
    };

    this.passPerc = function () {
        return (this.passCount() / this.totalCount()) * 100;
    };
    this.pendingPerc = function () {
        return (this.pendingCount() / this.totalCount()) * 100;
    };
    this.failPerc = function () {
        return (this.failCount() / this.totalCount()) * 100;
    };
    this.totalCount = function () {
        return this.passCount() + this.failCount() + this.pendingCount();
    };


    var results = [
    {
        "description": "login as SampleForm|SampleForm login test",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 276,
        "browser": {
            "name": "chrome",
            "version": "133.0.6943.127"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "000f00e8-0047-007a-008b-001300e400bd.png",
        "timestamp": 1740631141132,
        "duration": 12516
    },
    {
        "description": "login as customerpage|Customer login test",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 36336,
        "browser": {
            "name": "chrome",
            "version": "133.0.6943.127"
        },
        "message": [
            "Failed: No element found using locator: by.ngClick(\"customer()\")"
        ],
        "trace": [
            "NoSuchElementError: No element found using locator: by.ngClick(\"customer()\")\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:814:27\n    at ManagedPromise.invokeCallback_ (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (node:internal/process/task_queues:105:5)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.<computed> [as click] (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.<computed> [as click] (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at customerinfo.customerlogin (C:\\Users\\SHVYSYAR\\OneDrive - Capgemini\\Documents\\Protractorpageobject\\pages\\customerinfo.js:12:94)\n    at UserContext.<anonymous> (C:\\Users\\SHVYSYAR\\OneDrive - Capgemini\\Documents\\Protractorpageobject\\test_spec\\customerinfo_spec.js:11:22)\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\nFrom: Task: Run it(\"login as customerpage\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\SHVYSYAR\\OneDrive - Capgemini\\Documents\\Protractorpageobject\\test_spec\\customerinfo_spec.js:7:5)\n    at addSpecsToSuite (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\SHVYSYAR\\OneDrive - Capgemini\\Documents\\Protractorpageobject\\test_spec\\customerinfo_spec.js:5:1)\n    at Module._compile (node:internal/modules/cjs/loader:1739:14)\n    at Object..js (node:internal/modules/cjs/loader:1904:10)\n    at Module.load (node:internal/modules/cjs/loader:1473:32)\n    at Function._load (node:internal/modules/cjs/loader:1285:12)"
        ],
        "browserLogs": [],
        "screenShotFile": "000a0025-0054-0047-0009-005100ba00b4.png",
        "timestamp": 1740631323729,
        "duration": 1197
    },
    {
        "description": "go to withdrawl page|Customer login test",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 36336,
        "browser": {
            "name": "chrome",
            "version": "133.0.6943.127"
        },
        "message": [
            "Failed: No element found using locator: by.ngClick(\"withdrawl()\")"
        ],
        "trace": [
            "NoSuchElementError: No element found using locator: by.ngClick(\"withdrawl()\")\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:814:27\n    at ManagedPromise.invokeCallback_ (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (node:internal/process/task_queues:105:5)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.<computed> [as click] (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.<computed> [as click] (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at customerinfo.gotowithdrawl (C:\\Users\\SHVYSYAR\\OneDrive - Capgemini\\Documents\\Protractorpageobject\\pages\\customerinfo.js:44:108)\n    at UserContext.<anonymous> (C:\\Users\\SHVYSYAR\\OneDrive - Capgemini\\Documents\\Protractorpageobject\\test_spec\\customerinfo_spec.js:27:18)\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\nFrom: Task: Run it(\"go to withdrawl page\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\SHVYSYAR\\OneDrive - Capgemini\\Documents\\Protractorpageobject\\test_spec\\customerinfo_spec.js:25:3)\n    at addSpecsToSuite (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\SHVYSYAR\\OneDrive - Capgemini\\Documents\\Protractorpageobject\\test_spec\\customerinfo_spec.js:5:1)\n    at Module._compile (node:internal/modules/cjs/loader:1739:14)\n    at Object..js (node:internal/modules/cjs/loader:1904:10)\n    at Module.load (node:internal/modules/cjs/loader:1473:32)\n    at Function._load (node:internal/modules/cjs/loader:1285:12)"
        ],
        "browserLogs": [],
        "screenShotFile": "002f0027-006f-0090-00ad-00ab005400bb.png",
        "timestamp": 1740631325275,
        "duration": 2319
    },
    {
        "description": "goto customertransaction page|Customer login test",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 36336,
        "browser": {
            "name": "chrome",
            "version": "133.0.6943.127"
        },
        "message": [
            "Failed: No element found using locator: by.ngClick(\"transactions()\")"
        ],
        "trace": [
            "NoSuchElementError: No element found using locator: by.ngClick(\"transactions()\")\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:814:27\n    at ManagedPromise.invokeCallback_ (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (node:internal/process/task_queues:105:5)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.<computed> [as click] (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.<computed> [as click] (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at customerinfo.gototransactions (C:\\Users\\SHVYSYAR\\OneDrive - Capgemini\\Documents\\Protractorpageobject\\pages\\customerinfo.js:88:147)\n    at UserContext.<anonymous> (C:\\Users\\SHVYSYAR\\OneDrive - Capgemini\\Documents\\Protractorpageobject\\test_spec\\customerinfo_spec.js:51:18)\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\nFrom: Task: Run it(\"goto customertransaction page\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\SHVYSYAR\\OneDrive - Capgemini\\Documents\\Protractorpageobject\\test_spec\\customerinfo_spec.js:49:3)\n    at addSpecsToSuite (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\SHVYSYAR\\OneDrive - Capgemini\\Documents\\Protractorpageobject\\test_spec\\customerinfo_spec.js:5:1)\n    at Module._compile (node:internal/modules/cjs/loader:1739:14)\n    at Object..js (node:internal/modules/cjs/loader:1904:10)\n    at Module.load (node:internal/modules/cjs/loader:1473:32)\n    at Function._load (node:internal/modules/cjs/loader:1285:12)"
        ],
        "browserLogs": [],
        "screenShotFile": "00cd0036-00c6-002b-002c-005800da009a.png",
        "timestamp": 1740631327851,
        "duration": 1127
    },
    {
        "description": "login as customerpage|Customer login test",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 28624,
        "browser": {
            "name": "chrome",
            "version": "133.0.6943.127"
        },
        "message": [
            "Failed: No element found using locator: by.ngClick(\"customer()\")"
        ],
        "trace": [
            "NoSuchElementError: No element found using locator: by.ngClick(\"customer()\")\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:814:27\n    at ManagedPromise.invokeCallback_ (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (node:internal/process/task_queues:105:5)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.<computed> [as click] (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.<computed> [as click] (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at customerinfo.customerlogin (C:\\Users\\SHVYSYAR\\OneDrive - Capgemini\\Documents\\Protractorpageobject\\pages\\customerinfo.js:12:94)\n    at UserContext.<anonymous> (C:\\Users\\SHVYSYAR\\OneDrive - Capgemini\\Documents\\Protractorpageobject\\test_spec\\customerinfo_spec.js:11:22)\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\nFrom: Task: Run it(\"login as customerpage\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\SHVYSYAR\\OneDrive - Capgemini\\Documents\\Protractorpageobject\\test_spec\\customerinfo_spec.js:7:5)\n    at addSpecsToSuite (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\SHVYSYAR\\OneDrive - Capgemini\\Documents\\Protractorpageobject\\test_spec\\customerinfo_spec.js:5:1)\n    at Module._compile (node:internal/modules/cjs/loader:1739:14)\n    at Object..js (node:internal/modules/cjs/loader:1904:10)\n    at Module.load (node:internal/modules/cjs/loader:1473:32)\n    at Function._load (node:internal/modules/cjs/loader:1285:12)"
        ],
        "browserLogs": [],
        "screenShotFile": "00450003-00ce-0086-0060-002900cf0024.png",
        "timestamp": 1740631351469,
        "duration": 1093
    },
    {
        "description": "go to withdrawl page|Customer login test",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 28624,
        "browser": {
            "name": "chrome",
            "version": "133.0.6943.127"
        },
        "message": [
            "Failed: No element found using locator: by.ngClick(\"withdrawl()\")"
        ],
        "trace": [
            "NoSuchElementError: No element found using locator: by.ngClick(\"withdrawl()\")\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:814:27\n    at ManagedPromise.invokeCallback_ (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (node:internal/process/task_queues:105:5)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.<computed> [as click] (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.<computed> [as click] (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at customerinfo.gotowithdrawl (C:\\Users\\SHVYSYAR\\OneDrive - Capgemini\\Documents\\Protractorpageobject\\pages\\customerinfo.js:44:108)\n    at UserContext.<anonymous> (C:\\Users\\SHVYSYAR\\OneDrive - Capgemini\\Documents\\Protractorpageobject\\test_spec\\customerinfo_spec.js:27:18)\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\nFrom: Task: Run it(\"go to withdrawl page\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\SHVYSYAR\\OneDrive - Capgemini\\Documents\\Protractorpageobject\\test_spec\\customerinfo_spec.js:25:3)\n    at addSpecsToSuite (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\SHVYSYAR\\OneDrive - Capgemini\\Documents\\Protractorpageobject\\test_spec\\customerinfo_spec.js:5:1)\n    at Module._compile (node:internal/modules/cjs/loader:1739:14)\n    at Object..js (node:internal/modules/cjs/loader:1904:10)\n    at Module.load (node:internal/modules/cjs/loader:1473:32)\n    at Function._load (node:internal/modules/cjs/loader:1285:12)"
        ],
        "browserLogs": [],
        "screenShotFile": "007700e4-00c6-0043-0073-00de001d0025.png",
        "timestamp": 1740631353040,
        "duration": 2177
    },
    {
        "description": "goto customertransaction page|Customer login test",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 28624,
        "browser": {
            "name": "chrome",
            "version": "133.0.6943.127"
        },
        "message": [
            "Failed: No element found using locator: by.ngClick(\"transactions()\")"
        ],
        "trace": [
            "NoSuchElementError: No element found using locator: by.ngClick(\"transactions()\")\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:814:27\n    at ManagedPromise.invokeCallback_ (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (node:internal/process/task_queues:105:5)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.<computed> [as click] (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.<computed> [as click] (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at customerinfo.gototransactions (C:\\Users\\SHVYSYAR\\OneDrive - Capgemini\\Documents\\Protractorpageobject\\pages\\customerinfo.js:88:147)\n    at UserContext.<anonymous> (C:\\Users\\SHVYSYAR\\OneDrive - Capgemini\\Documents\\Protractorpageobject\\test_spec\\customerinfo_spec.js:51:18)\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\nFrom: Task: Run it(\"goto customertransaction page\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\SHVYSYAR\\OneDrive - Capgemini\\Documents\\Protractorpageobject\\test_spec\\customerinfo_spec.js:49:3)\n    at addSpecsToSuite (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\SHVYSYAR\\OneDrive - Capgemini\\Documents\\Protractorpageobject\\test_spec\\customerinfo_spec.js:5:1)\n    at Module._compile (node:internal/modules/cjs/loader:1739:14)\n    at Object..js (node:internal/modules/cjs/loader:1904:10)\n    at Module.load (node:internal/modules/cjs/loader:1473:32)\n    at Function._load (node:internal/modules/cjs/loader:1285:12)"
        ],
        "browserLogs": [],
        "screenShotFile": "00990059-002d-0089-0033-00df00e200f7.png",
        "timestamp": 1740631355460,
        "duration": 1155
    },
    {
        "description": "login as customerpage|Customer login test",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 26608,
        "browser": {
            "name": "chrome",
            "version": "133.0.6943.127"
        },
        "message": [
            "Failed: No element found using locator: by.ngClick(\"customer()\")"
        ],
        "trace": [
            "NoSuchElementError: No element found using locator: by.ngClick(\"customer()\")\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:814:27\n    at ManagedPromise.invokeCallback_ (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (node:internal/process/task_queues:105:5)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.<computed> [as click] (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.<computed> [as click] (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at customerinfo.customerlogin (C:\\Users\\SHVYSYAR\\OneDrive - Capgemini\\Documents\\Protractorpageobject\\pages\\customerinfo.js:12:94)\n    at UserContext.<anonymous> (C:\\Users\\SHVYSYAR\\OneDrive - Capgemini\\Documents\\Protractorpageobject\\test_spec\\customerinfo_spec.js:11:22)\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\nFrom: Task: Run it(\"login as customerpage\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\SHVYSYAR\\OneDrive - Capgemini\\Documents\\Protractorpageobject\\test_spec\\customerinfo_spec.js:7:5)\n    at addSpecsToSuite (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\SHVYSYAR\\OneDrive - Capgemini\\Documents\\Protractorpageobject\\test_spec\\customerinfo_spec.js:5:1)\n    at Module._compile (node:internal/modules/cjs/loader:1739:14)\n    at Object..js (node:internal/modules/cjs/loader:1904:10)\n    at Module.load (node:internal/modules/cjs/loader:1473:32)\n    at Function._load (node:internal/modules/cjs/loader:1285:12)"
        ],
        "browserLogs": [],
        "screenShotFile": "00b100a3-0057-0041-0093-000000620091.png",
        "timestamp": 1740631397646,
        "duration": 976
    },
    {
        "description": "go to withdrawl page|Customer login test",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 26608,
        "browser": {
            "name": "chrome",
            "version": "133.0.6943.127"
        },
        "message": [
            "Failed: No element found using locator: by.ngClick(\"withdrawl()\")"
        ],
        "trace": [
            "NoSuchElementError: No element found using locator: by.ngClick(\"withdrawl()\")\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:814:27\n    at ManagedPromise.invokeCallback_ (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (node:internal/process/task_queues:105:5)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.<computed> [as click] (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.<computed> [as click] (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at customerinfo.gotowithdrawl (C:\\Users\\SHVYSYAR\\OneDrive - Capgemini\\Documents\\Protractorpageobject\\pages\\customerinfo.js:44:108)\n    at UserContext.<anonymous> (C:\\Users\\SHVYSYAR\\OneDrive - Capgemini\\Documents\\Protractorpageobject\\test_spec\\customerinfo_spec.js:27:18)\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\nFrom: Task: Run it(\"go to withdrawl page\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\SHVYSYAR\\OneDrive - Capgemini\\Documents\\Protractorpageobject\\test_spec\\customerinfo_spec.js:25:3)\n    at addSpecsToSuite (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\SHVYSYAR\\OneDrive - Capgemini\\Documents\\Protractorpageobject\\test_spec\\customerinfo_spec.js:5:1)\n    at Module._compile (node:internal/modules/cjs/loader:1739:14)\n    at Object..js (node:internal/modules/cjs/loader:1904:10)\n    at Module.load (node:internal/modules/cjs/loader:1473:32)\n    at Function._load (node:internal/modules/cjs/loader:1285:12)"
        ],
        "browserLogs": [],
        "screenShotFile": "00cd0054-0037-00ee-00bb-003f008c00cc.png",
        "timestamp": 1740631398958,
        "duration": 2251
    },
    {
        "description": "goto customertransaction page|Customer login test",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 26608,
        "browser": {
            "name": "chrome",
            "version": "133.0.6943.127"
        },
        "message": [
            "Failed: No element found using locator: by.ngClick(\"transactions()\")"
        ],
        "trace": [
            "NoSuchElementError: No element found using locator: by.ngClick(\"transactions()\")\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:814:27\n    at ManagedPromise.invokeCallback_ (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (node:internal/process/task_queues:105:5)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.<computed> [as click] (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.<computed> [as click] (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at customerinfo.gototransactions (C:\\Users\\SHVYSYAR\\OneDrive - Capgemini\\Documents\\Protractorpageobject\\pages\\customerinfo.js:88:147)\n    at UserContext.<anonymous> (C:\\Users\\SHVYSYAR\\OneDrive - Capgemini\\Documents\\Protractorpageobject\\test_spec\\customerinfo_spec.js:51:18)\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\nFrom: Task: Run it(\"goto customertransaction page\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\SHVYSYAR\\OneDrive - Capgemini\\Documents\\Protractorpageobject\\test_spec\\customerinfo_spec.js:49:3)\n    at addSpecsToSuite (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\SHVYSYAR\\OneDrive - Capgemini\\Documents\\Protractorpageobject\\test_spec\\customerinfo_spec.js:5:1)\n    at Module._compile (node:internal/modules/cjs/loader:1739:14)\n    at Object..js (node:internal/modules/cjs/loader:1904:10)\n    at Module.load (node:internal/modules/cjs/loader:1473:32)\n    at Function._load (node:internal/modules/cjs/loader:1285:12)"
        ],
        "browserLogs": [],
        "screenShotFile": "00800033-0015-0093-0036-00c2008b00fc.png",
        "timestamp": 1740631401609,
        "duration": 1146
    },
    {
        "description": "login as SampleForm|SampleForm login test",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 35872,
        "browser": {
            "name": "chrome",
            "version": "133.0.6943.127"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00e40026-0094-0095-0089-001e00590053.png",
        "timestamp": 1740631452685,
        "duration": 13049
    },
    {
        "description": "login as SampleFormfiledtest|SampleForm login test",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 688,
        "browser": {
            "name": "chrome",
            "version": "133.0.6943.127"
        },
        "message": [
            "Expected '' to equal 'User registered successfully!'."
        ],
        "trace": [
            "Error: Failed expectation\n    at SampleFormfiledtest.SampleForminfo (C:\\Users\\SHVYSYAR\\OneDrive - Capgemini\\Documents\\Protractorpageobject\\pages\\samplepagefailedtest.js:38:94)\n    at UserContext.<anonymous> (C:\\Users\\SHVYSYAR\\OneDrive - Capgemini\\Documents\\Protractorpageobject\\test_spec\\SampleForm_spec failedtest.js:21:30)\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25"
        ],
        "browserLogs": [],
        "screenShotFile": "005e00b5-00a0-00c9-004b-007f000000b5.png",
        "timestamp": 1740631805148,
        "duration": 13346
    },
    {
        "description": "login as customerpage|Customer login test",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 18224,
        "browser": {
            "name": "chrome",
            "version": "133.0.6943.127"
        },
        "message": [
            "Failed: No element found using locator: by.ngClick(\"customer()\")"
        ],
        "trace": [
            "NoSuchElementError: No element found using locator: by.ngClick(\"customer()\")\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:814:27\n    at ManagedPromise.invokeCallback_ (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (node:internal/process/task_queues:105:5)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.<computed> [as click] (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.<computed> [as click] (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at customerinfo.customerlogin (C:\\Users\\SHVYSYAR\\OneDrive - Capgemini\\Documents\\Protractorpageobject\\pages\\customerinfo.js:12:94)\n    at UserContext.<anonymous> (C:\\Users\\SHVYSYAR\\OneDrive - Capgemini\\Documents\\Protractorpageobject\\test_spec\\customerinfo_spec.js:11:22)\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\nFrom: Task: Run it(\"login as customerpage\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\SHVYSYAR\\OneDrive - Capgemini\\Documents\\Protractorpageobject\\test_spec\\customerinfo_spec.js:7:5)\n    at addSpecsToSuite (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\SHVYSYAR\\OneDrive - Capgemini\\Documents\\Protractorpageobject\\test_spec\\customerinfo_spec.js:5:1)\n    at Module._compile (node:internal/modules/cjs/loader:1739:14)\n    at Object..js (node:internal/modules/cjs/loader:1904:10)\n    at Module.load (node:internal/modules/cjs/loader:1473:32)\n    at Function._load (node:internal/modules/cjs/loader:1285:12)"
        ],
        "browserLogs": [],
        "screenShotFile": "0047001c-0047-0061-000a-00ee00c900a3.png",
        "timestamp": 1740631886240,
        "duration": 8833
    },
    {
        "description": "go to withdrawl page|Customer login test",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 18224,
        "browser": {
            "name": "chrome",
            "version": "133.0.6943.127"
        },
        "message": [
            "Failed: No element found using locator: by.ngClick(\"withdrawl()\")"
        ],
        "trace": [
            "NoSuchElementError: No element found using locator: by.ngClick(\"withdrawl()\")\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:814:27\n    at ManagedPromise.invokeCallback_ (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (node:internal/process/task_queues:105:5)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.<computed> [as click] (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.<computed> [as click] (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at customerinfo.gotowithdrawl (C:\\Users\\SHVYSYAR\\OneDrive - Capgemini\\Documents\\Protractorpageobject\\pages\\customerinfo.js:44:108)\n    at UserContext.<anonymous> (C:\\Users\\SHVYSYAR\\OneDrive - Capgemini\\Documents\\Protractorpageobject\\test_spec\\customerinfo_spec.js:27:18)\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\nFrom: Task: Run it(\"go to withdrawl page\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\SHVYSYAR\\OneDrive - Capgemini\\Documents\\Protractorpageobject\\test_spec\\customerinfo_spec.js:25:3)\n    at addSpecsToSuite (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\SHVYSYAR\\OneDrive - Capgemini\\Documents\\Protractorpageobject\\test_spec\\customerinfo_spec.js:5:1)\n    at Module._compile (node:internal/modules/cjs/loader:1739:14)\n    at Object..js (node:internal/modules/cjs/loader:1904:10)\n    at Module.load (node:internal/modules/cjs/loader:1473:32)\n    at Function._load (node:internal/modules/cjs/loader:1285:12)"
        ],
        "browserLogs": [],
        "screenShotFile": "00d00012-00b3-0033-0050-002c00820003.png",
        "timestamp": 1740631895532,
        "duration": 2219
    },
    {
        "description": "goto customertransaction page|Customer login test",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 18224,
        "browser": {
            "name": "chrome",
            "version": "133.0.6943.127"
        },
        "message": [
            "Failed: No element found using locator: by.ngClick(\"transactions()\")"
        ],
        "trace": [
            "NoSuchElementError: No element found using locator: by.ngClick(\"transactions()\")\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:814:27\n    at ManagedPromise.invokeCallback_ (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (node:internal/process/task_queues:105:5)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.<computed> [as click] (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.<computed> [as click] (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at customerinfo.gototransactions (C:\\Users\\SHVYSYAR\\OneDrive - Capgemini\\Documents\\Protractorpageobject\\pages\\customerinfo.js:88:147)\n    at UserContext.<anonymous> (C:\\Users\\SHVYSYAR\\OneDrive - Capgemini\\Documents\\Protractorpageobject\\test_spec\\customerinfo_spec.js:51:18)\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\nFrom: Task: Run it(\"goto customertransaction page\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\SHVYSYAR\\OneDrive - Capgemini\\Documents\\Protractorpageobject\\test_spec\\customerinfo_spec.js:49:3)\n    at addSpecsToSuite (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\SHVYSYAR\\OneDrive - Capgemini\\Documents\\Protractorpageobject\\test_spec\\customerinfo_spec.js:5:1)\n    at Module._compile (node:internal/modules/cjs/loader:1739:14)\n    at Object..js (node:internal/modules/cjs/loader:1904:10)\n    at Module.load (node:internal/modules/cjs/loader:1473:32)\n    at Function._load (node:internal/modules/cjs/loader:1285:12)"
        ],
        "browserLogs": [],
        "screenShotFile": "00cd007c-00ec-0068-0006-004b00860009.png",
        "timestamp": 1740631898151,
        "duration": 1135
    },
    {
        "description": "login as customerpage|Customer login test",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 36432,
        "browser": {
            "name": "chrome",
            "version": "133.0.6943.127"
        },
        "message": [
            "Failed: No element found using locator: by.ngClick(\"customer()\")"
        ],
        "trace": [
            "NoSuchElementError: No element found using locator: by.ngClick(\"customer()\")\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:814:27\n    at ManagedPromise.invokeCallback_ (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (node:internal/process/task_queues:105:5)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.<computed> [as click] (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.<computed> [as click] (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at customerinfo.customerlogin (C:\\Users\\SHVYSYAR\\OneDrive - Capgemini\\Documents\\Protractorpageobject\\pages\\customerinfo.js:12:94)\n    at UserContext.<anonymous> (C:\\Users\\SHVYSYAR\\OneDrive - Capgemini\\Documents\\Protractorpageobject\\test_spec\\customerinfo_spec.js:11:22)\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\nFrom: Task: Run it(\"login as customerpage\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\SHVYSYAR\\OneDrive - Capgemini\\Documents\\Protractorpageobject\\test_spec\\customerinfo_spec.js:7:5)\n    at addSpecsToSuite (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\SHVYSYAR\\OneDrive - Capgemini\\Documents\\Protractorpageobject\\test_spec\\customerinfo_spec.js:5:1)\n    at Module._compile (node:internal/modules/cjs/loader:1739:14)\n    at Object..js (node:internal/modules/cjs/loader:1904:10)\n    at Module.load (node:internal/modules/cjs/loader:1473:32)\n    at Function._load (node:internal/modules/cjs/loader:1285:12)"
        ],
        "browserLogs": [],
        "screenShotFile": "00570089-006a-0025-0059-001b00840028.png",
        "timestamp": 1740631915872,
        "duration": 1592
    },
    {
        "description": "go to withdrawl page|Customer login test",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 36432,
        "browser": {
            "name": "chrome",
            "version": "133.0.6943.127"
        },
        "message": [
            "Failed: No element found using locator: by.ngClick(\"withdrawl()\")"
        ],
        "trace": [
            "NoSuchElementError: No element found using locator: by.ngClick(\"withdrawl()\")\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:814:27\n    at ManagedPromise.invokeCallback_ (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (node:internal/process/task_queues:105:5)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.<computed> [as click] (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.<computed> [as click] (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at customerinfo.gotowithdrawl (C:\\Users\\SHVYSYAR\\OneDrive - Capgemini\\Documents\\Protractorpageobject\\pages\\customerinfo.js:44:108)\n    at UserContext.<anonymous> (C:\\Users\\SHVYSYAR\\OneDrive - Capgemini\\Documents\\Protractorpageobject\\test_spec\\customerinfo_spec.js:27:18)\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\nFrom: Task: Run it(\"go to withdrawl page\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\SHVYSYAR\\OneDrive - Capgemini\\Documents\\Protractorpageobject\\test_spec\\customerinfo_spec.js:25:3)\n    at addSpecsToSuite (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\SHVYSYAR\\OneDrive - Capgemini\\Documents\\Protractorpageobject\\test_spec\\customerinfo_spec.js:5:1)\n    at Module._compile (node:internal/modules/cjs/loader:1739:14)\n    at Object..js (node:internal/modules/cjs/loader:1904:10)\n    at Module.load (node:internal/modules/cjs/loader:1473:32)\n    at Function._load (node:internal/modules/cjs/loader:1285:12)"
        ],
        "browserLogs": [],
        "screenShotFile": "00c8000a-007d-001f-00bd-00ef00ca008b.png",
        "timestamp": 1740631918002,
        "duration": 2177
    },
    {
        "description": "goto customertransaction page|Customer login test",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 36432,
        "browser": {
            "name": "chrome",
            "version": "133.0.6943.127"
        },
        "message": [
            "Failed: No element found using locator: by.ngClick(\"transactions()\")"
        ],
        "trace": [
            "NoSuchElementError: No element found using locator: by.ngClick(\"transactions()\")\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:814:27\n    at ManagedPromise.invokeCallback_ (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (node:internal/process/task_queues:105:5)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.<computed> [as click] (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.<computed> [as click] (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at customerinfo.gototransactions (C:\\Users\\SHVYSYAR\\OneDrive - Capgemini\\Documents\\Protractorpageobject\\pages\\customerinfo.js:88:147)\n    at UserContext.<anonymous> (C:\\Users\\SHVYSYAR\\OneDrive - Capgemini\\Documents\\Protractorpageobject\\test_spec\\customerinfo_spec.js:51:18)\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\nFrom: Task: Run it(\"goto customertransaction page\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\SHVYSYAR\\OneDrive - Capgemini\\Documents\\Protractorpageobject\\test_spec\\customerinfo_spec.js:49:3)\n    at addSpecsToSuite (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\SHVYSYAR\\OneDrive - Capgemini\\Documents\\Protractorpageobject\\test_spec\\customerinfo_spec.js:5:1)\n    at Module._compile (node:internal/modules/cjs/loader:1739:14)\n    at Object..js (node:internal/modules/cjs/loader:1904:10)\n    at Module.load (node:internal/modules/cjs/loader:1473:32)\n    at Function._load (node:internal/modules/cjs/loader:1285:12)"
        ],
        "browserLogs": [],
        "screenShotFile": "008700a3-003e-0035-0070-00250033009b.png",
        "timestamp": 1740631920406,
        "duration": 1178
    },
    {
        "description": "lifetimemembership login test page|lifetimememebership login page",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 22884,
        "browser": {
            "name": "chrome",
            "version": "133.0.6943.127"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://static.licdn.com/aero-v1/sc/h/bkks34264bp22axlz23u3ze5g 1 Canvas2D: Multiple readback operations using getImageData are faster with the willReadFrequently attribute set to true. See: https://html.spec.whatwg.org/multipage/canvas.html#concept-canvas-will-read-frequently",
                "timestamp": 1740631976631,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://static.licdn.com/aero-v1/sc/h/bkks34264bp22axlz23u3ze5g 1 Canvas2D: Multiple readback operations using getImageData are faster with the willReadFrequently attribute set to true. See: https://html.spec.whatwg.org/multipage/canvas.html#concept-canvas-will-read-frequently",
                "timestamp": 1740631976704,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://static.licdn.com/aero-v1/sc/h/bkks34264bp22axlz23u3ze5g 1 Canvas2D: Multiple readback operations using getImageData are faster with the willReadFrequently attribute set to true. See: https://html.spec.whatwg.org/multipage/canvas.html#concept-canvas-will-read-frequently",
                "timestamp": 1740631976720,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://static.licdn.com/aero-v1/sc/h/29rdkxlvag0d3cpj96fiilbju 168:166 \"[GSI_LOGGER]: Your client application may not display the Google One Tap in its default position. When FedCM becomes mandatory, One Tap only displays in the default position. Refer to the migration guide to update your code accordingly and opt-in to FedCM to test your changes. Learn more: https://developers.google.com/identity/gsi/web/guides/fedcm-migration?s=dc#layout\"",
                "timestamp": 1740631977146,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://static.licdn.com/aero-v1/sc/h/29rdkxlvag0d3cpj96fiilbju 168:166 \"[GSI_LOGGER]: Your client application uses one of the Google One Tap prompt UI status methods that may stop functioning when FedCM becomes mandatory. Refer to the migration guide to update your code accordingly and opt-in to FedCM to test your changes. Learn more: https://developers.google.com/identity/gsi/web/guides/fedcm-migration?s=dc#display_moment and https://developers.google.com/identity/gsi/web/guides/fedcm-migration?s=dc#skipped_moment\"",
                "timestamp": 1740631977146,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://static.licdn.com/aero-v1/sc/h/29rdkxlvag0d3cpj96fiilbju 168:166 \"[GSI_LOGGER]: Currently, you disable FedCM on Google One Tap. FedCM for One Tap will become mandatory starting Oct 2024, and you won’t be able to disable it. Refer to the migration guide to update your code accordingly to ensure users will not be blocked from logging in. Learn more: https://developers.google.com/identity/gsi/web/guides/fedcm-migration\"",
                "timestamp": 1740631977146,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://static.licdn.com/aero-v1/sc/h/29rdkxlvag0d3cpj96fiilbju 168:166 \"[GSI_LOGGER]: Currently, you disable FedCM on Google One Tap. FedCM for One Tap will become mandatory starting Oct 2024, and you won’t be able to disable it. Refer to the migration guide to update your code accordingly to ensure users will not be blocked from logging in. Learn more: https://developers.google.com/identity/gsi/web/guides/fedcm-migration\"",
                "timestamp": 1740631977146,
                "type": ""
            }
        ],
        "screenShotFile": "004f0073-0054-00f7-0018-0045005b00e8.png",
        "timestamp": 1740631967075,
        "duration": 10114
    },
    {
        "description": "bankmanager login page|BankManager login test",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 6520,
        "browser": {
            "name": "chrome",
            "version": "133.0.6943.127"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "007d0057-0002-002e-001d-00dd001f00e8.png",
        "timestamp": 1740632165935,
        "duration": 5898
    },
    {
        "description": "Add custome page|BankManager login test",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 6520,
        "browser": {
            "name": "chrome",
            "version": "133.0.6943.127"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00fc008d-00ae-0032-0066-004700d100bb.png",
        "timestamp": 1740632172204,
        "duration": 7633
    },
    {
        "description": "Add openaccount page|BankManager login test",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 6520,
        "browser": {
            "name": "chrome",
            "version": "133.0.6943.127"
        },
        "message": [
            "Failed: No element found using locator: By(css selector, *[id=\"userSelect\"])"
        ],
        "trace": [
            "NoSuchElementError: No element found using locator: By(css selector, *[id=\"userSelect\"])\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:814:27\n    at ManagedPromise.invokeCallback_ (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (node:internal/process/task_queues:105:5)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.<computed> [as click] (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at SelectWrapper.selectByValue (C:\\Users\\SHVYSYAR\\OneDrive - Capgemini\\Documents\\Protractorpageobject\\util\\select-wrapper.js:14:73)\n    at BankManagerinfo.gotoopenaccount (C:\\Users\\SHVYSYAR\\OneDrive - Capgemini\\Documents\\Protractorpageobject\\pages\\AddBankManagerDetails.js:45:14)\n    at UserContext.<anonymous> (C:\\Users\\SHVYSYAR\\OneDrive - Capgemini\\Documents\\Protractorpageobject\\test_spec\\AddBankManagerDetails_spec.js:22:27)\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\nFrom: Task: Run it(\"Add openaccount page\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\SHVYSYAR\\OneDrive - Capgemini\\Documents\\Protractorpageobject\\test_spec\\AddBankManagerDetails_spec.js:20:2)\n    at addSpecsToSuite (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\SHVYSYAR\\OneDrive - Capgemini\\Documents\\Protractorpageobject\\test_spec\\AddBankManagerDetails_spec.js:5:1)\n    at Module._compile (node:internal/modules/cjs/loader:1739:14)\n    at Object..js (node:internal/modules/cjs/loader:1904:10)\n    at Module.load (node:internal/modules/cjs/loader:1473:32)\n    at Function._load (node:internal/modules/cjs/loader:1285:12)"
        ],
        "browserLogs": [],
        "screenShotFile": "0019007f-00f9-00ca-008b-007e007200d3.png",
        "timestamp": 1740632179984,
        "duration": 295
    },
    {
        "description": "Add customer page|BankManager login test",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 6520,
        "browser": {
            "name": "chrome",
            "version": "133.0.6943.127"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00a80076-006c-001d-00bd-00d50000001c.png",
        "timestamp": 1740632180580,
        "duration": 1319
    },
    {
        "description": "bankmanager login page|BankManager login test",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 680,
        "browser": {
            "name": "chrome",
            "version": "133.0.6943.127"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "005200b1-0038-0020-009c-00f3009b0010.png",
        "timestamp": 1740632221711,
        "duration": 5609
    },
    {
        "description": "Add custome page|BankManager login test",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 680,
        "browser": {
            "name": "chrome",
            "version": "133.0.6943.127"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "004500b3-00d0-0077-0006-00e100630093.png",
        "timestamp": 1740632227683,
        "duration": 7763
    },
    {
        "description": "Add openaccount page|BankManager login test",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 680,
        "browser": {
            "name": "chrome",
            "version": "133.0.6943.127"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "009700df-0072-00c4-00e1-002c003d0072.png",
        "timestamp": 1740632235598,
        "duration": 6856
    },
    {
        "description": "Add customer page|BankManager login test",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 680,
        "browser": {
            "name": "chrome",
            "version": "133.0.6943.127"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "009f0094-004c-00f6-0078-0029001a002d.png",
        "timestamp": 1740632242622,
        "duration": 1349
    },
    {
        "description": "bankmanager login page|BankManager login test",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 34708,
        "browser": {
            "name": "chrome",
            "version": "133.0.6943.127"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00c700dc-00d6-006b-0092-00cb00f800e8.png",
        "timestamp": 1740632310535,
        "duration": 9069
    },
    {
        "description": "Add custome page|BankManager login test",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 34708,
        "browser": {
            "name": "chrome",
            "version": "133.0.6943.127"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00620064-00dc-00b4-00e7-00da006a00ae.png",
        "timestamp": 1740632319961,
        "duration": 7790
    },
    {
        "description": "Add openaccount page|BankManager login test",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 34708,
        "browser": {
            "name": "chrome",
            "version": "133.0.6943.127"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00cb000b-00fb-00e0-00e0-003f00a90060.png",
        "timestamp": 1740632327984,
        "duration": 6859
    },
    {
        "description": "Add customer page|BankManager login test",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 34708,
        "browser": {
            "name": "chrome",
            "version": "133.0.6943.127"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00e20077-0090-0000-002c-00ae00f20004.png",
        "timestamp": 1740632335002,
        "duration": 1337
    },
    {
        "description": "login as customerpage|Customer login test",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 17876,
        "browser": {
            "name": "chrome",
            "version": "133.0.6943.127"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00a80063-0021-0044-00c6-006000fd00e7.png",
        "timestamp": 1740632394914,
        "duration": 17140
    },
    {
        "description": "go to withdrawl page|Customer login test",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 17876,
        "browser": {
            "name": "chrome",
            "version": "133.0.6943.127"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://www.way2automation.com/angularjs-protractor/banking/account.service.js 33:18 \"Can not perform this transaction\"",
                "timestamp": 1740632417901,
                "type": ""
            }
        ],
        "screenShotFile": "005100b2-0070-00e4-004c-003e00cc0049.png",
        "timestamp": 1740632412425,
        "duration": 12226
    },
    {
        "description": "goto customertransaction page|Customer login test",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 17876,
        "browser": {
            "name": "chrome",
            "version": "133.0.6943.127"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00d700eb-0059-00f7-00c1-00ca003d00e2.png",
        "timestamp": 1740632424805,
        "duration": 4357
    },
    {
        "description": "login as customerpage|Customer login test",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 29528,
        "browser": {
            "name": "chrome",
            "version": "133.0.6943.127"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "006400fb-00f5-00d5-0069-009d00ea00aa.png",
        "timestamp": 1740632525727,
        "duration": 17540
    },
    {
        "description": "go to withdrawl page|Customer login test",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 29528,
        "browser": {
            "name": "chrome",
            "version": "133.0.6943.127"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://www.way2automation.com/angularjs-protractor/banking/account.service.js 33:18 \"Can not perform this transaction\"",
                "timestamp": 1740632549135,
                "type": ""
            }
        ],
        "screenShotFile": "0072005d-003e-0094-00de-00c900ee00af.png",
        "timestamp": 1740632543639,
        "duration": 12302
    },
    {
        "description": "goto customertransaction page|Customer login test",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 29528,
        "browser": {
            "name": "chrome",
            "version": "133.0.6943.127"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "001b0029-00f3-007b-0096-0081009400da.png",
        "timestamp": 1740632556137,
        "duration": 4357
    },
    {
        "description": "login as customerpage|Customer login test",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 31344,
        "browser": {
            "name": "chrome",
            "version": "133.0.6943.127"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "001100e2-004a-0080-00cc-0046005a004e.png",
        "timestamp": 1740632579871,
        "duration": 16740
    },
    {
        "description": "go to withdrawl page|Customer login test",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 31344,
        "browser": {
            "name": "chrome",
            "version": "133.0.6943.127"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://www.way2automation.com/angularjs-protractor/banking/account.service.js 33:18 \"Can not perform this transaction\"",
                "timestamp": 1740632602402,
                "type": ""
            }
        ],
        "screenShotFile": "00a20054-0093-0012-00f5-007300d500fe.png",
        "timestamp": 1740632596990,
        "duration": 12218
    },
    {
        "description": "goto customertransaction page|Customer login test",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 31344,
        "browser": {
            "name": "chrome",
            "version": "133.0.6943.127"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00b30075-0098-0038-00e3-005a00ae00a2.png",
        "timestamp": 1740632609371,
        "duration": 4353
    },
    {
        "description": "login as customerpage|Customer login test",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 5288,
        "browser": {
            "name": "chrome",
            "version": "133.0.6943.127"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00a50076-0095-009a-007d-00d2008500d0.png",
        "timestamp": 1740632814992,
        "duration": 16716
    },
    {
        "description": "go to withdrawl page|Customer login test",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 5288,
        "browser": {
            "name": "chrome",
            "version": "133.0.6943.127"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://www.way2automation.com/angularjs-protractor/banking/account.service.js 33:18 \"Can not perform this transaction\"",
                "timestamp": 1740632837536,
                "type": ""
            }
        ],
        "screenShotFile": "000d00d9-0018-00e6-00a3-005700230033.png",
        "timestamp": 1740632832115,
        "duration": 12103
    },
    {
        "description": "goto customertransaction page|Customer login test",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 5288,
        "browser": {
            "name": "chrome",
            "version": "133.0.6943.127"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "006100c1-00dc-008c-005e-00c700ff00b7.png",
        "timestamp": 1740632844388,
        "duration": 4294
    },
    {
        "description": "bankmanager login page|BankManager login test",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 35484,
        "browser": {
            "name": "chrome",
            "version": "133.0.6943.127"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "003f000a-006f-005d-0052-009c00ef00af.png",
        "timestamp": 1740632905399,
        "duration": 6354
    },
    {
        "description": "Add custome page|BankManager login test",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 35484,
        "browser": {
            "name": "chrome",
            "version": "133.0.6943.127"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00490097-00d3-0044-00b2-0056003e0071.png",
        "timestamp": 1740632912151,
        "duration": 7721
    },
    {
        "description": "Add openaccount page|BankManager login test",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 35484,
        "browser": {
            "name": "chrome",
            "version": "133.0.6943.127"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00ee0080-0084-0028-0000-0050004a006c.png",
        "timestamp": 1740632920072,
        "duration": 6791
    },
    {
        "description": "Add customer page|BankManager login test",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 35484,
        "browser": {
            "name": "chrome",
            "version": "133.0.6943.127"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "0049003a-0043-00bb-00a2-00e000b90046.png",
        "timestamp": 1740632927020,
        "duration": 1308
    },
    {
        "description": "login as customerpage|Customer login test",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 4888,
        "browser": {
            "name": "chrome",
            "version": "133.0.6943.127"
        },
        "message": [
            "Failed: Error while running testForAngular: no such window: target window already closed\nfrom unknown error: web view not found\n  (Session info: chrome=133.0.6943.127)\n  (Driver info: chromedriver=133.0.6943.53 (9a80935019b0925b01cc21d254da203bc3986f04-refs/branch-heads/6943@{#1389}),platform=Windows NT 10.0.22631 x86_64)",
            "NoSuchWindowError: no such window: target window already closed\nfrom unknown error: web view not found\n  (Session info: chrome=133.0.6943.127)\n  (Driver info: chromedriver=133.0.6943.53 (9a80935019b0925b01cc21d254da203bc3986f04-refs/branch-heads/6943@{#1389}),platform=Windows NT 10.0.22631 x86_64)"
        ],
        "trace": [
            "Error: Error while running testForAngular: no such window: target window already closed\nfrom unknown error: web view not found\n  (Session info: chrome=133.0.6943.127)\n  (Driver info: chromedriver=133.0.6943.53 (9a80935019b0925b01cc21d254da203bc3986f04-refs/branch-heads/6943@{#1389}),platform=Windows NT 10.0.22631 x86_64)\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:725:23\n    at ManagedPromise.invokeCallback_ (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (node:internal/process/task_queues:105:5)\nFrom: Task: Run it(\"login as customerpage\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\SHVYSYAR\\OneDrive - Capgemini\\Documents\\Protractorpageobject\\test_spec\\customerinfo_spec.js:7:5)\n    at addSpecsToSuite (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\SHVYSYAR\\OneDrive - Capgemini\\Documents\\Protractorpageobject\\test_spec\\customerinfo_spec.js:5:1)\n    at Module._compile (node:internal/modules/cjs/loader:1739:14)\n    at Object..js (node:internal/modules/cjs/loader:1904:10)\n    at Module.load (node:internal/modules/cjs/loader:1473:32)\n    at Function._load (node:internal/modules/cjs/loader:1285:12)",
            "NoSuchWindowError: no such window: target window already closed\nfrom unknown error: web view not found\n  (Session info: chrome=133.0.6943.127)\n  (Driver info: chromedriver=133.0.6943.53 (9a80935019b0925b01cc21d254da203bc3986f04-refs/branch-heads/6943@{#1389}),platform=Windows NT 10.0.22631 x86_64)\n    at Object.checkLegacyResponse (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:546:15)\n    at parseHttpResponse (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:441:30\n    at processTicksAndRejections (node:internal/process/task_queues:105:5)\nFrom: Task: WebDriver.takeScreenshot()\n    at Driver.schedule (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at Driver.takeScreenshot (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:1085:17)\n    at run (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:58:33)\n    at ProtractorBrowser.to.<computed> [as takeScreenshot] (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:66:16)\n    at UserContext.<anonymous> (C:\\Users\\SHVYSYAR\\OneDrive - Capgemini\\Documents\\Protractorpageobject\\conf\\conf.js:56:13)\n    at attempt (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9"
        ],
        "browserLogs": [],
        "timestamp": 1740633069018,
        "duration": 23937
    },
    {
        "description": "bankmanager login page|BankManager login test",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 6448,
        "browser": {
            "name": "chrome",
            "version": "133.0.6943.127"
        },
        "message": [
            "Failed: Error while running testForAngular: no such window: target window already closed\nfrom unknown error: web view not found\n  (Session info: chrome=133.0.6943.127)\n  (Driver info: chromedriver=133.0.6943.53 (9a80935019b0925b01cc21d254da203bc3986f04-refs/branch-heads/6943@{#1389}),platform=Windows NT 10.0.22631 x86_64)",
            "NoSuchWindowError: no such window: target window already closed\nfrom unknown error: web view not found\n  (Session info: chrome=133.0.6943.127)\n  (Driver info: chromedriver=133.0.6943.53 (9a80935019b0925b01cc21d254da203bc3986f04-refs/branch-heads/6943@{#1389}),platform=Windows NT 10.0.22631 x86_64)"
        ],
        "trace": [
            "Error: Error while running testForAngular: no such window: target window already closed\nfrom unknown error: web view not found\n  (Session info: chrome=133.0.6943.127)\n  (Driver info: chromedriver=133.0.6943.53 (9a80935019b0925b01cc21d254da203bc3986f04-refs/branch-heads/6943@{#1389}),platform=Windows NT 10.0.22631 x86_64)\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:725:23\n    at ManagedPromise.invokeCallback_ (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (node:internal/process/task_queues:105:5)\nFrom: Task: Run it(\"bankmanager login page\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\SHVYSYAR\\OneDrive - Capgemini\\Documents\\Protractorpageobject\\test_spec\\AddBankManagerDetails_spec.js:8:5)\n    at addSpecsToSuite (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\SHVYSYAR\\OneDrive - Capgemini\\Documents\\Protractorpageobject\\test_spec\\AddBankManagerDetails_spec.js:5:1)\n    at Module._compile (node:internal/modules/cjs/loader:1739:14)\n    at Object..js (node:internal/modules/cjs/loader:1904:10)\n    at Module.load (node:internal/modules/cjs/loader:1473:32)\n    at Function._load (node:internal/modules/cjs/loader:1285:12)",
            "NoSuchWindowError: no such window: target window already closed\nfrom unknown error: web view not found\n  (Session info: chrome=133.0.6943.127)\n  (Driver info: chromedriver=133.0.6943.53 (9a80935019b0925b01cc21d254da203bc3986f04-refs/branch-heads/6943@{#1389}),platform=Windows NT 10.0.22631 x86_64)\n    at Object.checkLegacyResponse (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:546:15)\n    at parseHttpResponse (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:441:30\n    at processTicksAndRejections (node:internal/process/task_queues:105:5)\nFrom: Task: WebDriver.takeScreenshot()\n    at Driver.schedule (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at Driver.takeScreenshot (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:1085:17)\n    at run (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:58:33)\n    at ProtractorBrowser.to.<computed> [as takeScreenshot] (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:66:16)\n    at UserContext.<anonymous> (C:\\Users\\SHVYSYAR\\OneDrive - Capgemini\\Documents\\Protractorpageobject\\conf\\conf.js:56:13)\n    at attempt (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9"
        ],
        "browserLogs": [],
        "timestamp": 1740633069044,
        "duration": 24566
    },
    {
        "description": "Add custome page|BankManager login test",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 6448,
        "browser": {
            "name": "chrome",
            "version": "133.0.6943.127"
        },
        "message": [
            "Failed: no such window: target window already closed\nfrom unknown error: web view not found\n  (Session info: chrome=133.0.6943.127)\n  (Driver info: chromedriver=133.0.6943.53 (9a80935019b0925b01cc21d254da203bc3986f04-refs/branch-heads/6943@{#1389}),platform=Windows NT 10.0.22631 x86_64)",
            "NoSuchWindowError: no such window: target window already closed\nfrom unknown error: web view not found\n  (Session info: chrome=133.0.6943.127)\n  (Driver info: chromedriver=133.0.6943.53 (9a80935019b0925b01cc21d254da203bc3986f04-refs/branch-heads/6943@{#1389}),platform=Windows NT 10.0.22631 x86_64)"
        ],
        "trace": [
            "NoSuchWindowError: no such window: target window already closed\nfrom unknown error: web view not found\n  (Session info: chrome=133.0.6943.127)\n  (Driver info: chromedriver=133.0.6943.53 (9a80935019b0925b01cc21d254da203bc3986f04-refs/branch-heads/6943@{#1389}),platform=Windows NT 10.0.22631 x86_64)\n    at Object.checkLegacyResponse (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:546:15)\n    at parseHttpResponse (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:441:30\n    at processTicksAndRejections (node:internal/process/task_queues:105:5)\nFrom: Task: Protractor.waitForAngular() - Locator: by.ngClick(\"addCust()\")\n    at Driver.schedule (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at ProtractorBrowser.executeAsyncScript_ (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:423:28)\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:454:33\n    at ManagedPromise.invokeCallback_ (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (node:internal/process/task_queues:105:5)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.<computed> [as click] (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.<computed> [as click] (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at BankManagerinfo.gotoaddcustomer (C:\\Users\\SHVYSYAR\\OneDrive - Capgemini\\Documents\\Protractorpageobject\\pages\\AddBankManagerDetails.js:18:71)\n    at UserContext.<anonymous> (C:\\Users\\SHVYSYAR\\OneDrive - Capgemini\\Documents\\Protractorpageobject\\test_spec\\AddBankManagerDetails_spec.js:15:32)\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\nFrom: Task: Run it(\"Add custome page\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\SHVYSYAR\\OneDrive - Capgemini\\Documents\\Protractorpageobject\\test_spec\\AddBankManagerDetails_spec.js:14:5)\n    at addSpecsToSuite (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\SHVYSYAR\\OneDrive - Capgemini\\Documents\\Protractorpageobject\\test_spec\\AddBankManagerDetails_spec.js:5:1)\n    at Module._compile (node:internal/modules/cjs/loader:1739:14)\n    at Object..js (node:internal/modules/cjs/loader:1904:10)\n    at Module.load (node:internal/modules/cjs/loader:1473:32)\n    at Function._load (node:internal/modules/cjs/loader:1285:12)",
            "NoSuchWindowError: no such window: target window already closed\nfrom unknown error: web view not found\n  (Session info: chrome=133.0.6943.127)\n  (Driver info: chromedriver=133.0.6943.53 (9a80935019b0925b01cc21d254da203bc3986f04-refs/branch-heads/6943@{#1389}),platform=Windows NT 10.0.22631 x86_64)\n    at Object.checkLegacyResponse (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:546:15)\n    at parseHttpResponse (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:441:30\n    at processTicksAndRejections (node:internal/process/task_queues:105:5)\nFrom: Task: WebDriver.takeScreenshot()\n    at Driver.schedule (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at Driver.takeScreenshot (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:1085:17)\n    at run (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:58:33)\n    at ProtractorBrowser.to.<computed> [as takeScreenshot] (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:66:16)\n    at UserContext.<anonymous> (C:\\Users\\SHVYSYAR\\OneDrive - Capgemini\\Documents\\Protractorpageobject\\conf\\conf.js:56:13)\n    at attempt (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9"
        ],
        "browserLogs": [],
        "timestamp": 1740633093828,
        "duration": 26
    },
    {
        "description": "Add openaccount page|BankManager login test",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 6448,
        "browser": {
            "name": "chrome",
            "version": "133.0.6943.127"
        },
        "message": [
            "Failed: no such window: target window already closed\nfrom unknown error: web view not found\n  (Session info: chrome=133.0.6943.127)\n  (Driver info: chromedriver=133.0.6943.53 (9a80935019b0925b01cc21d254da203bc3986f04-refs/branch-heads/6943@{#1389}),platform=Windows NT 10.0.22631 x86_64)",
            "NoSuchWindowError: no such window: target window already closed\nfrom unknown error: web view not found\n  (Session info: chrome=133.0.6943.127)\n  (Driver info: chromedriver=133.0.6943.53 (9a80935019b0925b01cc21d254da203bc3986f04-refs/branch-heads/6943@{#1389}),platform=Windows NT 10.0.22631 x86_64)"
        ],
        "trace": [
            "NoSuchWindowError: no such window: target window already closed\nfrom unknown error: web view not found\n  (Session info: chrome=133.0.6943.127)\n  (Driver info: chromedriver=133.0.6943.53 (9a80935019b0925b01cc21d254da203bc3986f04-refs/branch-heads/6943@{#1389}),platform=Windows NT 10.0.22631 x86_64)\n    at Object.checkLegacyResponse (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:546:15)\n    at parseHttpResponse (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:441:30\n    at processTicksAndRejections (node:internal/process/task_queues:105:5)\nFrom: Task: Protractor.waitForAngular() - Locator: by.ngClick(\"openAccount()\")\n    at Driver.schedule (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at ProtractorBrowser.executeAsyncScript_ (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:423:28)\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:454:33\n    at ManagedPromise.invokeCallback_ (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (node:internal/process/task_queues:105:5)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.<computed> [as click] (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.<computed> [as click] (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at BankManagerinfo.gotoopenaccount (C:\\Users\\SHVYSYAR\\OneDrive - Capgemini\\Documents\\Protractorpageobject\\pages\\AddBankManagerDetails.js:44:62)\n    at UserContext.<anonymous> (C:\\Users\\SHVYSYAR\\OneDrive - Capgemini\\Documents\\Protractorpageobject\\test_spec\\AddBankManagerDetails_spec.js:22:27)\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\nFrom: Task: Run it(\"Add openaccount page\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\SHVYSYAR\\OneDrive - Capgemini\\Documents\\Protractorpageobject\\test_spec\\AddBankManagerDetails_spec.js:20:2)\n    at addSpecsToSuite (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\SHVYSYAR\\OneDrive - Capgemini\\Documents\\Protractorpageobject\\test_spec\\AddBankManagerDetails_spec.js:5:1)\n    at Module._compile (node:internal/modules/cjs/loader:1739:14)\n    at Object..js (node:internal/modules/cjs/loader:1904:10)\n    at Module.load (node:internal/modules/cjs/loader:1473:32)\n    at Function._load (node:internal/modules/cjs/loader:1285:12)",
            "NoSuchWindowError: no such window: target window already closed\nfrom unknown error: web view not found\n  (Session info: chrome=133.0.6943.127)\n  (Driver info: chromedriver=133.0.6943.53 (9a80935019b0925b01cc21d254da203bc3986f04-refs/branch-heads/6943@{#1389}),platform=Windows NT 10.0.22631 x86_64)\n    at Object.checkLegacyResponse (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:546:15)\n    at parseHttpResponse (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:441:30\n    at processTicksAndRejections (node:internal/process/task_queues:105:5)\nFrom: Task: WebDriver.takeScreenshot()\n    at Driver.schedule (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at Driver.takeScreenshot (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:1085:17)\n    at run (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:58:33)\n    at ProtractorBrowser.to.<computed> [as takeScreenshot] (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:66:16)\n    at UserContext.<anonymous> (C:\\Users\\SHVYSYAR\\OneDrive - Capgemini\\Documents\\Protractorpageobject\\conf\\conf.js:56:13)\n    at attempt (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9"
        ],
        "browserLogs": [],
        "timestamp": 1740633093906,
        "duration": 32
    },
    {
        "description": "Add customer page|BankManager login test",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 6448,
        "browser": {
            "name": "chrome",
            "version": "133.0.6943.127"
        },
        "message": [
            "Failed: no such window: target window already closed\nfrom unknown error: web view not found\n  (Session info: chrome=133.0.6943.127)\n  (Driver info: chromedriver=133.0.6943.53 (9a80935019b0925b01cc21d254da203bc3986f04-refs/branch-heads/6943@{#1389}),platform=Windows NT 10.0.22631 x86_64)",
            "NoSuchWindowError: no such window: target window already closed\nfrom unknown error: web view not found\n  (Session info: chrome=133.0.6943.127)\n  (Driver info: chromedriver=133.0.6943.53 (9a80935019b0925b01cc21d254da203bc3986f04-refs/branch-heads/6943@{#1389}),platform=Windows NT 10.0.22631 x86_64)"
        ],
        "trace": [
            "NoSuchWindowError: no such window: target window already closed\nfrom unknown error: web view not found\n  (Session info: chrome=133.0.6943.127)\n  (Driver info: chromedriver=133.0.6943.53 (9a80935019b0925b01cc21d254da203bc3986f04-refs/branch-heads/6943@{#1389}),platform=Windows NT 10.0.22631 x86_64)\n    at Object.checkLegacyResponse (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:546:15)\n    at parseHttpResponse (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:441:30\n    at processTicksAndRejections (node:internal/process/task_queues:105:5)\nFrom: Task: Protractor.waitForAngular() - Locator: by.ngClick(\"showCust()\")\n    at Driver.schedule (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at ProtractorBrowser.executeAsyncScript_ (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:423:28)\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:454:33\n    at ManagedPromise.invokeCallback_ (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (node:internal/process/task_queues:105:5)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.<computed> [as click] (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.<computed> [as click] (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at BankManagerinfo.gotocustomer (C:\\Users\\SHVYSYAR\\OneDrive - Capgemini\\Documents\\Protractorpageobject\\pages\\AddBankManagerDetails.js:62:64)\n    at UserContext.<anonymous> (C:\\Users\\SHVYSYAR\\OneDrive - Capgemini\\Documents\\Protractorpageobject\\test_spec\\AddBankManagerDetails_spec.js:26:27)\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\nFrom: Task: Run it(\"Add customer page\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\SHVYSYAR\\OneDrive - Capgemini\\Documents\\Protractorpageobject\\test_spec\\AddBankManagerDetails_spec.js:24:1)\n    at addSpecsToSuite (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\SHVYSYAR\\OneDrive - Capgemini\\Documents\\Protractorpageobject\\test_spec\\AddBankManagerDetails_spec.js:5:1)\n    at Module._compile (node:internal/modules/cjs/loader:1739:14)\n    at Object..js (node:internal/modules/cjs/loader:1904:10)\n    at Module.load (node:internal/modules/cjs/loader:1473:32)\n    at Function._load (node:internal/modules/cjs/loader:1285:12)",
            "NoSuchWindowError: no such window: target window already closed\nfrom unknown error: web view not found\n  (Session info: chrome=133.0.6943.127)\n  (Driver info: chromedriver=133.0.6943.53 (9a80935019b0925b01cc21d254da203bc3986f04-refs/branch-heads/6943@{#1389}),platform=Windows NT 10.0.22631 x86_64)\n    at Object.checkLegacyResponse (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:546:15)\n    at parseHttpResponse (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:441:30\n    at processTicksAndRejections (node:internal/process/task_queues:105:5)\nFrom: Task: WebDriver.takeScreenshot()\n    at Driver.schedule (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at Driver.takeScreenshot (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:1085:17)\n    at run (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:58:33)\n    at ProtractorBrowser.to.<computed> [as takeScreenshot] (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:66:16)\n    at UserContext.<anonymous> (C:\\Users\\SHVYSYAR\\OneDrive - Capgemini\\Documents\\Protractorpageobject\\conf\\conf.js:56:13)\n    at attempt (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9"
        ],
        "browserLogs": [],
        "timestamp": 1740633093987,
        "duration": 14
    },
    {
        "description": "go to withdrawl page|Customer login test",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 4888,
        "browser": {
            "name": "chrome",
            "version": "133.0.6943.127"
        },
        "message": [
            "Failed: no such window: target window already closed\nfrom unknown error: web view not found\n  (Session info: chrome=133.0.6943.127)\n  (Driver info: chromedriver=133.0.6943.53 (9a80935019b0925b01cc21d254da203bc3986f04-refs/branch-heads/6943@{#1389}),platform=Windows NT 10.0.22631 x86_64)",
            "NoSuchWindowError: no such window: target window already closed\nfrom unknown error: web view not found\n  (Session info: chrome=133.0.6943.127)\n  (Driver info: chromedriver=133.0.6943.53 (9a80935019b0925b01cc21d254da203bc3986f04-refs/branch-heads/6943@{#1389}),platform=Windows NT 10.0.22631 x86_64)"
        ],
        "trace": [
            "NoSuchWindowError: no such window: target window already closed\nfrom unknown error: web view not found\n  (Session info: chrome=133.0.6943.127)\n  (Driver info: chromedriver=133.0.6943.53 (9a80935019b0925b01cc21d254da203bc3986f04-refs/branch-heads/6943@{#1389}),platform=Windows NT 10.0.22631 x86_64)\n    at Object.checkLegacyResponse (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:546:15)\n    at parseHttpResponse (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:441:30\n    at processTicksAndRejections (node:internal/process/task_queues:105:5)\nFrom: Task: Protractor.waitForAngular() - Locator: by.ngClick(\"withdrawl()\")\n    at Driver.schedule (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at ProtractorBrowser.executeAsyncScript_ (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:423:28)\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:454:33\n    at ManagedPromise.invokeCallback_ (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.<computed> [as click] (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.<computed> [as click] (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at customerinfo.gotowithdrawl (C:\\Users\\SHVYSYAR\\OneDrive - Capgemini\\Documents\\Protractorpageobject\\pages\\customerinfo.js:44:108)\n    at UserContext.<anonymous> (C:\\Users\\SHVYSYAR\\OneDrive - Capgemini\\Documents\\Protractorpageobject\\test_spec\\customerinfo_spec.js:27:18)\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\nFrom: Task: Run it(\"go to withdrawl page\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\SHVYSYAR\\OneDrive - Capgemini\\Documents\\Protractorpageobject\\test_spec\\customerinfo_spec.js:25:3)\n    at addSpecsToSuite (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\SHVYSYAR\\OneDrive - Capgemini\\Documents\\Protractorpageobject\\test_spec\\customerinfo_spec.js:5:1)\n    at Module._compile (node:internal/modules/cjs/loader:1739:14)\n    at Object..js (node:internal/modules/cjs/loader:1904:10)\n    at Module.load (node:internal/modules/cjs/loader:1473:32)\n    at Function._load (node:internal/modules/cjs/loader:1285:12)",
            "NoSuchWindowError: no such window: target window already closed\nfrom unknown error: web view not found\n  (Session info: chrome=133.0.6943.127)\n  (Driver info: chromedriver=133.0.6943.53 (9a80935019b0925b01cc21d254da203bc3986f04-refs/branch-heads/6943@{#1389}),platform=Windows NT 10.0.22631 x86_64)\n    at Object.checkLegacyResponse (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:546:15)\n    at parseHttpResponse (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:441:30\n    at processTicksAndRejections (node:internal/process/task_queues:105:5)\nFrom: Task: WebDriver.takeScreenshot()\n    at Driver.schedule (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at Driver.takeScreenshot (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:1085:17)\n    at run (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:58:33)\n    at ProtractorBrowser.to.<computed> [as takeScreenshot] (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:66:16)\n    at UserContext.<anonymous> (C:\\Users\\SHVYSYAR\\OneDrive - Capgemini\\Documents\\Protractorpageobject\\conf\\conf.js:56:13)\n    at attempt (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9"
        ],
        "browserLogs": [],
        "timestamp": 1740633093197,
        "duration": 2045
    },
    {
        "description": "goto customertransaction page|Customer login test",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 4888,
        "browser": {
            "name": "chrome",
            "version": "133.0.6943.127"
        },
        "message": [
            "Failed: no such window: target window already closed\nfrom unknown error: web view not found\n  (Session info: chrome=133.0.6943.127)\n  (Driver info: chromedriver=133.0.6943.53 (9a80935019b0925b01cc21d254da203bc3986f04-refs/branch-heads/6943@{#1389}),platform=Windows NT 10.0.22631 x86_64)",
            "NoSuchWindowError: no such window: target window already closed\nfrom unknown error: web view not found\n  (Session info: chrome=133.0.6943.127)\n  (Driver info: chromedriver=133.0.6943.53 (9a80935019b0925b01cc21d254da203bc3986f04-refs/branch-heads/6943@{#1389}),platform=Windows NT 10.0.22631 x86_64)"
        ],
        "trace": [
            "NoSuchWindowError: no such window: target window already closed\nfrom unknown error: web view not found\n  (Session info: chrome=133.0.6943.127)\n  (Driver info: chromedriver=133.0.6943.53 (9a80935019b0925b01cc21d254da203bc3986f04-refs/branch-heads/6943@{#1389}),platform=Windows NT 10.0.22631 x86_64)\n    at Object.checkLegacyResponse (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:546:15)\n    at parseHttpResponse (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:441:30\n    at processTicksAndRejections (node:internal/process/task_queues:105:5)\nFrom: Task: Protractor.waitForAngular() - Locator: by.ngClick(\"transactions()\")\n    at Driver.schedule (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at ProtractorBrowser.executeAsyncScript_ (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:423:28)\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:454:33\n    at ManagedPromise.invokeCallback_ (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.<computed> [as click] (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.<computed> [as click] (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at customerinfo.gototransactions (C:\\Users\\SHVYSYAR\\OneDrive - Capgemini\\Documents\\Protractorpageobject\\pages\\customerinfo.js:88:147)\n    at UserContext.<anonymous> (C:\\Users\\SHVYSYAR\\OneDrive - Capgemini\\Documents\\Protractorpageobject\\test_spec\\customerinfo_spec.js:51:18)\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\nFrom: Task: Run it(\"goto customertransaction page\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\SHVYSYAR\\OneDrive - Capgemini\\Documents\\Protractorpageobject\\test_spec\\customerinfo_spec.js:49:3)\n    at addSpecsToSuite (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\SHVYSYAR\\OneDrive - Capgemini\\Documents\\Protractorpageobject\\test_spec\\customerinfo_spec.js:5:1)\n    at Module._compile (node:internal/modules/cjs/loader:1739:14)\n    at Object..js (node:internal/modules/cjs/loader:1904:10)\n    at Module.load (node:internal/modules/cjs/loader:1473:32)\n    at Function._load (node:internal/modules/cjs/loader:1285:12)",
            "NoSuchWindowError: no such window: target window already closed\nfrom unknown error: web view not found\n  (Session info: chrome=133.0.6943.127)\n  (Driver info: chromedriver=133.0.6943.53 (9a80935019b0925b01cc21d254da203bc3986f04-refs/branch-heads/6943@{#1389}),platform=Windows NT 10.0.22631 x86_64)\n    at Object.checkLegacyResponse (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:546:15)\n    at parseHttpResponse (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:441:30\n    at processTicksAndRejections (node:internal/process/task_queues:105:5)\nFrom: Task: WebDriver.takeScreenshot()\n    at Driver.schedule (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at Driver.takeScreenshot (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:1085:17)\n    at run (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:58:33)\n    at ProtractorBrowser.to.<computed> [as takeScreenshot] (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:66:16)\n    at UserContext.<anonymous> (C:\\Users\\SHVYSYAR\\OneDrive - Capgemini\\Documents\\Protractorpageobject\\conf\\conf.js:56:13)\n    at attempt (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9"
        ],
        "browserLogs": [],
        "timestamp": 1740633095311,
        "duration": 1043
    },
    {
        "description": "login as customerpage|Customer login test",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 35532,
        "browser": {
            "name": "chrome",
            "version": "133.0.6943.127"
        },
        "message": [
            "Error: Timeout - Async callback was not invoked within timeout specified by jasmine.DEFAULT_TIMEOUT_INTERVAL.",
            "Failed: Error while running testForAngular: no such window: target window already closed\nfrom unknown error: web view not found\n  (Session info: chrome=133.0.6943.127)\n  (Driver info: chromedriver=133.0.6943.53 (9a80935019b0925b01cc21d254da203bc3986f04-refs/branch-heads/6943@{#1389}),platform=Windows NT 10.0.22631 x86_64)",
            "NoSuchWindowError: no such window: target window already closed\nfrom unknown error: web view not found\n  (Session info: chrome=133.0.6943.127)\n  (Driver info: chromedriver=133.0.6943.53 (9a80935019b0925b01cc21d254da203bc3986f04-refs/branch-heads/6943@{#1389}),platform=Windows NT 10.0.22631 x86_64)"
        ],
        "trace": [
            "Error: Timeout - Async callback was not invoked within timeout specified by jasmine.DEFAULT_TIMEOUT_INTERVAL.\n    at Timeout._onTimeout (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4281:23)\n    at listOnTimeout (node:internal/timers:614:17)\n    at processTimers (node:internal/timers:549:7)",
            "Error: Error while running testForAngular: no such window: target window already closed\nfrom unknown error: web view not found\n  (Session info: chrome=133.0.6943.127)\n  (Driver info: chromedriver=133.0.6943.53 (9a80935019b0925b01cc21d254da203bc3986f04-refs/branch-heads/6943@{#1389}),platform=Windows NT 10.0.22631 x86_64)\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:725:23\n    at ManagedPromise.invokeCallback_ (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (node:internal/process/task_queues:105:5)\nFrom: Task: Run it(\"login as customerpage\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\SHVYSYAR\\OneDrive - Capgemini\\Documents\\Protractorpageobject\\test_spec\\customerinfo_spec.js:7:5)\n    at addSpecsToSuite (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\SHVYSYAR\\OneDrive - Capgemini\\Documents\\Protractorpageobject\\test_spec\\customerinfo_spec.js:5:1)\n    at Module._compile (node:internal/modules/cjs/loader:1739:14)\n    at Object..js (node:internal/modules/cjs/loader:1904:10)\n    at Module.load (node:internal/modules/cjs/loader:1473:32)\n    at Function._load (node:internal/modules/cjs/loader:1285:12)",
            "NoSuchWindowError: no such window: target window already closed\nfrom unknown error: web view not found\n  (Session info: chrome=133.0.6943.127)\n  (Driver info: chromedriver=133.0.6943.53 (9a80935019b0925b01cc21d254da203bc3986f04-refs/branch-heads/6943@{#1389}),platform=Windows NT 10.0.22631 x86_64)\n    at Object.checkLegacyResponse (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:546:15)\n    at parseHttpResponse (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:441:30\n    at processTicksAndRejections (node:internal/process/task_queues:105:5)\nFrom: Task: WebDriver.takeScreenshot()\n    at Driver.schedule (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at Driver.takeScreenshot (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:1085:17)\n    at run (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:58:33)\n    at ProtractorBrowser.to.<computed> [as takeScreenshot] (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:66:16)\n    at UserContext.<anonymous> (C:\\Users\\SHVYSYAR\\OneDrive - Capgemini\\Documents\\Protractorpageobject\\conf\\conf.js:56:13)\n    at attempt (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9"
        ],
        "browserLogs": [],
        "timestamp": 1740633138894,
        "duration": 30301
    },
    {
        "description": "bankmanager login page|BankManager login test",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 22200,
        "browser": {
            "name": "chrome",
            "version": "133.0.6943.127"
        },
        "message": [
            "Error: Timeout - Async callback was not invoked within timeout specified by jasmine.DEFAULT_TIMEOUT_INTERVAL.",
            "Failed: Cannot read properties of null (reading 'ver')",
            "NoSuchWindowError: no such window: target window already closed\nfrom unknown error: web view not found\n  (Session info: chrome=133.0.6943.127)\n  (Driver info: chromedriver=133.0.6943.53 (9a80935019b0925b01cc21d254da203bc3986f04-refs/branch-heads/6943@{#1389}),platform=Windows NT 10.0.22631 x86_64)"
        ],
        "trace": [
            "Error: Timeout - Async callback was not invoked within timeout specified by jasmine.DEFAULT_TIMEOUT_INTERVAL.\n    at Timeout._onTimeout (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4281:23)\n    at listOnTimeout (node:internal/timers:614:17)\n    at processTimers (node:internal/timers:549:7)",
            "TypeError: Cannot read properties of null (reading 'ver')\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:714:56\n    at ManagedPromise.invokeCallback_ (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (node:internal/process/task_queues:105:5)\nFrom: Task: Run it(\"bankmanager login page\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\SHVYSYAR\\OneDrive - Capgemini\\Documents\\Protractorpageobject\\test_spec\\AddBankManagerDetails_spec.js:8:5)\n    at addSpecsToSuite (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\SHVYSYAR\\OneDrive - Capgemini\\Documents\\Protractorpageobject\\test_spec\\AddBankManagerDetails_spec.js:5:1)\n    at Module._compile (node:internal/modules/cjs/loader:1739:14)\n    at Object..js (node:internal/modules/cjs/loader:1904:10)\n    at Module.load (node:internal/modules/cjs/loader:1473:32)\n    at Function._load (node:internal/modules/cjs/loader:1285:12)",
            "NoSuchWindowError: no such window: target window already closed\nfrom unknown error: web view not found\n  (Session info: chrome=133.0.6943.127)\n  (Driver info: chromedriver=133.0.6943.53 (9a80935019b0925b01cc21d254da203bc3986f04-refs/branch-heads/6943@{#1389}),platform=Windows NT 10.0.22631 x86_64)\n    at Object.checkLegacyResponse (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:546:15)\n    at parseHttpResponse (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:441:30\n    at processTicksAndRejections (node:internal/process/task_queues:105:5)\nFrom: Task: WebDriver.takeScreenshot()\n    at Driver.schedule (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at Driver.takeScreenshot (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:1085:17)\n    at run (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:58:33)\n    at ProtractorBrowser.to.<computed> [as takeScreenshot] (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:66:16)\n    at UserContext.<anonymous> (C:\\Users\\SHVYSYAR\\OneDrive - Capgemini\\Documents\\Protractorpageobject\\conf\\conf.js:56:13)\n    at attempt (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9"
        ],
        "browserLogs": [],
        "timestamp": 1740633138815,
        "duration": 30722
    },
    {
        "description": "Add custome page|BankManager login test",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 22200,
        "browser": {
            "name": "chrome",
            "version": "133.0.6943.127"
        },
        "message": [
            "Failed: no such window: target window already closed\nfrom unknown error: web view not found\n  (Session info: chrome=133.0.6943.127)\n  (Driver info: chromedriver=133.0.6943.53 (9a80935019b0925b01cc21d254da203bc3986f04-refs/branch-heads/6943@{#1389}),platform=Windows NT 10.0.22631 x86_64)",
            "NoSuchWindowError: no such window: target window already closed\nfrom unknown error: web view not found\n  (Session info: chrome=133.0.6943.127)\n  (Driver info: chromedriver=133.0.6943.53 (9a80935019b0925b01cc21d254da203bc3986f04-refs/branch-heads/6943@{#1389}),platform=Windows NT 10.0.22631 x86_64)"
        ],
        "trace": [
            "NoSuchWindowError: no such window: target window already closed\nfrom unknown error: web view not found\n  (Session info: chrome=133.0.6943.127)\n  (Driver info: chromedriver=133.0.6943.53 (9a80935019b0925b01cc21d254da203bc3986f04-refs/branch-heads/6943@{#1389}),platform=Windows NT 10.0.22631 x86_64)\n    at Object.checkLegacyResponse (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:546:15)\n    at parseHttpResponse (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:441:30\n    at processTicksAndRejections (node:internal/process/task_queues:105:5)\nFrom: Task: Protractor.waitForAngular() - Locator: by.ngClick(\"addCust()\")\n    at Driver.schedule (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at ProtractorBrowser.executeAsyncScript_ (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:423:28)\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:454:33\n    at ManagedPromise.invokeCallback_ (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (node:internal/process/task_queues:105:5)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.<computed> [as click] (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.<computed> [as click] (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at BankManagerinfo.gotoaddcustomer (C:\\Users\\SHVYSYAR\\OneDrive - Capgemini\\Documents\\Protractorpageobject\\pages\\AddBankManagerDetails.js:18:71)\n    at UserContext.<anonymous> (C:\\Users\\SHVYSYAR\\OneDrive - Capgemini\\Documents\\Protractorpageobject\\test_spec\\AddBankManagerDetails_spec.js:15:32)\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\nFrom: Task: Run it(\"Add custome page\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\SHVYSYAR\\OneDrive - Capgemini\\Documents\\Protractorpageobject\\test_spec\\AddBankManagerDetails_spec.js:14:5)\n    at addSpecsToSuite (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\SHVYSYAR\\OneDrive - Capgemini\\Documents\\Protractorpageobject\\test_spec\\AddBankManagerDetails_spec.js:5:1)\n    at Module._compile (node:internal/modules/cjs/loader:1739:14)\n    at Object..js (node:internal/modules/cjs/loader:1904:10)\n    at Module.load (node:internal/modules/cjs/loader:1473:32)\n    at Function._load (node:internal/modules/cjs/loader:1285:12)",
            "NoSuchWindowError: no such window: target window already closed\nfrom unknown error: web view not found\n  (Session info: chrome=133.0.6943.127)\n  (Driver info: chromedriver=133.0.6943.53 (9a80935019b0925b01cc21d254da203bc3986f04-refs/branch-heads/6943@{#1389}),platform=Windows NT 10.0.22631 x86_64)\n    at Object.checkLegacyResponse (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:546:15)\n    at parseHttpResponse (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:441:30\n    at processTicksAndRejections (node:internal/process/task_queues:105:5)\nFrom: Task: WebDriver.takeScreenshot()\n    at Driver.schedule (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at Driver.takeScreenshot (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:1085:17)\n    at run (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:58:33)\n    at ProtractorBrowser.to.<computed> [as takeScreenshot] (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:66:16)\n    at UserContext.<anonymous> (C:\\Users\\SHVYSYAR\\OneDrive - Capgemini\\Documents\\Protractorpageobject\\conf\\conf.js:56:13)\n    at attempt (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9"
        ],
        "browserLogs": [],
        "timestamp": 1740633169777,
        "duration": 23
    },
    {
        "description": "Add openaccount page|BankManager login test",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 22200,
        "browser": {
            "name": "chrome",
            "version": "133.0.6943.127"
        },
        "message": [
            "Failed: no such window: target window already closed\nfrom unknown error: web view not found\n  (Session info: chrome=133.0.6943.127)\n  (Driver info: chromedriver=133.0.6943.53 (9a80935019b0925b01cc21d254da203bc3986f04-refs/branch-heads/6943@{#1389}),platform=Windows NT 10.0.22631 x86_64)",
            "NoSuchWindowError: no such window: target window already closed\nfrom unknown error: web view not found\n  (Session info: chrome=133.0.6943.127)\n  (Driver info: chromedriver=133.0.6943.53 (9a80935019b0925b01cc21d254da203bc3986f04-refs/branch-heads/6943@{#1389}),platform=Windows NT 10.0.22631 x86_64)"
        ],
        "trace": [
            "NoSuchWindowError: no such window: target window already closed\nfrom unknown error: web view not found\n  (Session info: chrome=133.0.6943.127)\n  (Driver info: chromedriver=133.0.6943.53 (9a80935019b0925b01cc21d254da203bc3986f04-refs/branch-heads/6943@{#1389}),platform=Windows NT 10.0.22631 x86_64)\n    at Object.checkLegacyResponse (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:546:15)\n    at parseHttpResponse (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:441:30\n    at processTicksAndRejections (node:internal/process/task_queues:105:5)\nFrom: Task: Protractor.waitForAngular() - Locator: by.ngClick(\"openAccount()\")\n    at Driver.schedule (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at ProtractorBrowser.executeAsyncScript_ (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:423:28)\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:454:33\n    at ManagedPromise.invokeCallback_ (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (node:internal/process/task_queues:105:5)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.<computed> [as click] (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.<computed> [as click] (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at BankManagerinfo.gotoopenaccount (C:\\Users\\SHVYSYAR\\OneDrive - Capgemini\\Documents\\Protractorpageobject\\pages\\AddBankManagerDetails.js:44:62)\n    at UserContext.<anonymous> (C:\\Users\\SHVYSYAR\\OneDrive - Capgemini\\Documents\\Protractorpageobject\\test_spec\\AddBankManagerDetails_spec.js:22:27)\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\nFrom: Task: Run it(\"Add openaccount page\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\SHVYSYAR\\OneDrive - Capgemini\\Documents\\Protractorpageobject\\test_spec\\AddBankManagerDetails_spec.js:20:2)\n    at addSpecsToSuite (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\SHVYSYAR\\OneDrive - Capgemini\\Documents\\Protractorpageobject\\test_spec\\AddBankManagerDetails_spec.js:5:1)\n    at Module._compile (node:internal/modules/cjs/loader:1739:14)\n    at Object..js (node:internal/modules/cjs/loader:1904:10)\n    at Module.load (node:internal/modules/cjs/loader:1473:32)\n    at Function._load (node:internal/modules/cjs/loader:1285:12)",
            "NoSuchWindowError: no such window: target window already closed\nfrom unknown error: web view not found\n  (Session info: chrome=133.0.6943.127)\n  (Driver info: chromedriver=133.0.6943.53 (9a80935019b0925b01cc21d254da203bc3986f04-refs/branch-heads/6943@{#1389}),platform=Windows NT 10.0.22631 x86_64)\n    at Object.checkLegacyResponse (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:546:15)\n    at parseHttpResponse (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:441:30\n    at processTicksAndRejections (node:internal/process/task_queues:105:5)\nFrom: Task: WebDriver.takeScreenshot()\n    at Driver.schedule (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at Driver.takeScreenshot (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:1085:17)\n    at run (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:58:33)\n    at ProtractorBrowser.to.<computed> [as takeScreenshot] (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:66:16)\n    at UserContext.<anonymous> (C:\\Users\\SHVYSYAR\\OneDrive - Capgemini\\Documents\\Protractorpageobject\\conf\\conf.js:56:13)\n    at attempt (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9"
        ],
        "browserLogs": [],
        "timestamp": 1740633169855,
        "duration": 25
    },
    {
        "description": "Add customer page|BankManager login test",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 22200,
        "browser": {
            "name": "chrome",
            "version": "133.0.6943.127"
        },
        "message": [
            "Failed: no such window: target window already closed\nfrom unknown error: web view not found\n  (Session info: chrome=133.0.6943.127)\n  (Driver info: chromedriver=133.0.6943.53 (9a80935019b0925b01cc21d254da203bc3986f04-refs/branch-heads/6943@{#1389}),platform=Windows NT 10.0.22631 x86_64)",
            "NoSuchWindowError: no such window: target window already closed\nfrom unknown error: web view not found\n  (Session info: chrome=133.0.6943.127)\n  (Driver info: chromedriver=133.0.6943.53 (9a80935019b0925b01cc21d254da203bc3986f04-refs/branch-heads/6943@{#1389}),platform=Windows NT 10.0.22631 x86_64)"
        ],
        "trace": [
            "NoSuchWindowError: no such window: target window already closed\nfrom unknown error: web view not found\n  (Session info: chrome=133.0.6943.127)\n  (Driver info: chromedriver=133.0.6943.53 (9a80935019b0925b01cc21d254da203bc3986f04-refs/branch-heads/6943@{#1389}),platform=Windows NT 10.0.22631 x86_64)\n    at Object.checkLegacyResponse (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:546:15)\n    at parseHttpResponse (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:441:30\n    at processTicksAndRejections (node:internal/process/task_queues:105:5)\nFrom: Task: Protractor.waitForAngular() - Locator: by.ngClick(\"showCust()\")\n    at Driver.schedule (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at ProtractorBrowser.executeAsyncScript_ (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:423:28)\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:454:33\n    at ManagedPromise.invokeCallback_ (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (node:internal/process/task_queues:105:5)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.<computed> [as click] (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.<computed> [as click] (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at BankManagerinfo.gotocustomer (C:\\Users\\SHVYSYAR\\OneDrive - Capgemini\\Documents\\Protractorpageobject\\pages\\AddBankManagerDetails.js:62:64)\n    at UserContext.<anonymous> (C:\\Users\\SHVYSYAR\\OneDrive - Capgemini\\Documents\\Protractorpageobject\\test_spec\\AddBankManagerDetails_spec.js:26:27)\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\nFrom: Task: Run it(\"Add customer page\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\SHVYSYAR\\OneDrive - Capgemini\\Documents\\Protractorpageobject\\test_spec\\AddBankManagerDetails_spec.js:24:1)\n    at addSpecsToSuite (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\SHVYSYAR\\OneDrive - Capgemini\\Documents\\Protractorpageobject\\test_spec\\AddBankManagerDetails_spec.js:5:1)\n    at Module._compile (node:internal/modules/cjs/loader:1739:14)\n    at Object..js (node:internal/modules/cjs/loader:1904:10)\n    at Module.load (node:internal/modules/cjs/loader:1473:32)\n    at Function._load (node:internal/modules/cjs/loader:1285:12)",
            "NoSuchWindowError: no such window: target window already closed\nfrom unknown error: web view not found\n  (Session info: chrome=133.0.6943.127)\n  (Driver info: chromedriver=133.0.6943.53 (9a80935019b0925b01cc21d254da203bc3986f04-refs/branch-heads/6943@{#1389}),platform=Windows NT 10.0.22631 x86_64)\n    at Object.checkLegacyResponse (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:546:15)\n    at parseHttpResponse (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:441:30\n    at processTicksAndRejections (node:internal/process/task_queues:105:5)\nFrom: Task: WebDriver.takeScreenshot()\n    at Driver.schedule (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at Driver.takeScreenshot (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:1085:17)\n    at run (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:58:33)\n    at ProtractorBrowser.to.<computed> [as takeScreenshot] (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:66:16)\n    at UserContext.<anonymous> (C:\\Users\\SHVYSYAR\\OneDrive - Capgemini\\Documents\\Protractorpageobject\\conf\\conf.js:56:13)\n    at attempt (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9"
        ],
        "browserLogs": [],
        "timestamp": 1740633169933,
        "duration": 25
    },
    {
        "description": "go to withdrawl page|Customer login test",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 35532,
        "browser": {
            "name": "chrome",
            "version": "133.0.6943.127"
        },
        "message": [
            "Failed: no such window: target window already closed\nfrom unknown error: web view not found\n  (Session info: chrome=133.0.6943.127)\n  (Driver info: chromedriver=133.0.6943.53 (9a80935019b0925b01cc21d254da203bc3986f04-refs/branch-heads/6943@{#1389}),platform=Windows NT 10.0.22631 x86_64)",
            "NoSuchWindowError: no such window: target window already closed\nfrom unknown error: web view not found\n  (Session info: chrome=133.0.6943.127)\n  (Driver info: chromedriver=133.0.6943.53 (9a80935019b0925b01cc21d254da203bc3986f04-refs/branch-heads/6943@{#1389}),platform=Windows NT 10.0.22631 x86_64)"
        ],
        "trace": [
            "NoSuchWindowError: no such window: target window already closed\nfrom unknown error: web view not found\n  (Session info: chrome=133.0.6943.127)\n  (Driver info: chromedriver=133.0.6943.53 (9a80935019b0925b01cc21d254da203bc3986f04-refs/branch-heads/6943@{#1389}),platform=Windows NT 10.0.22631 x86_64)\n    at Object.checkLegacyResponse (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:546:15)\n    at parseHttpResponse (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:441:30\n    at processTicksAndRejections (node:internal/process/task_queues:105:5)\nFrom: Task: Protractor.waitForAngular() - Locator: by.ngClick(\"withdrawl()\")\n    at Driver.schedule (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at ProtractorBrowser.executeAsyncScript_ (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:423:28)\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:454:33\n    at ManagedPromise.invokeCallback_ (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.<computed> [as click] (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.<computed> [as click] (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at customerinfo.gotowithdrawl (C:\\Users\\SHVYSYAR\\OneDrive - Capgemini\\Documents\\Protractorpageobject\\pages\\customerinfo.js:44:108)\n    at UserContext.<anonymous> (C:\\Users\\SHVYSYAR\\OneDrive - Capgemini\\Documents\\Protractorpageobject\\test_spec\\customerinfo_spec.js:27:18)\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\nFrom: Task: Run it(\"go to withdrawl page\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\SHVYSYAR\\OneDrive - Capgemini\\Documents\\Protractorpageobject\\test_spec\\customerinfo_spec.js:25:3)\n    at addSpecsToSuite (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\SHVYSYAR\\OneDrive - Capgemini\\Documents\\Protractorpageobject\\test_spec\\customerinfo_spec.js:5:1)\n    at Module._compile (node:internal/modules/cjs/loader:1739:14)\n    at Object..js (node:internal/modules/cjs/loader:1904:10)\n    at Module.load (node:internal/modules/cjs/loader:1473:32)\n    at Function._load (node:internal/modules/cjs/loader:1285:12)",
            "NoSuchWindowError: no such window: target window already closed\nfrom unknown error: web view not found\n  (Session info: chrome=133.0.6943.127)\n  (Driver info: chromedriver=133.0.6943.53 (9a80935019b0925b01cc21d254da203bc3986f04-refs/branch-heads/6943@{#1389}),platform=Windows NT 10.0.22631 x86_64)\n    at Object.checkLegacyResponse (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:546:15)\n    at parseHttpResponse (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:441:30\n    at processTicksAndRejections (node:internal/process/task_queues:105:5)\nFrom: Task: WebDriver.takeScreenshot()\n    at Driver.schedule (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at Driver.takeScreenshot (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:1085:17)\n    at run (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:58:33)\n    at ProtractorBrowser.to.<computed> [as takeScreenshot] (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:66:16)\n    at UserContext.<anonymous> (C:\\Users\\SHVYSYAR\\OneDrive - Capgemini\\Documents\\Protractorpageobject\\conf\\conf.js:56:13)\n    at attempt (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9"
        ],
        "browserLogs": [],
        "timestamp": 1740633169406,
        "duration": 2053
    },
    {
        "description": "goto customertransaction page|Customer login test",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 35532,
        "browser": {
            "name": "chrome",
            "version": "133.0.6943.127"
        },
        "message": [
            "Failed: no such window: target window already closed\nfrom unknown error: web view not found\n  (Session info: chrome=133.0.6943.127)\n  (Driver info: chromedriver=133.0.6943.53 (9a80935019b0925b01cc21d254da203bc3986f04-refs/branch-heads/6943@{#1389}),platform=Windows NT 10.0.22631 x86_64)",
            "NoSuchWindowError: no such window: target window already closed\nfrom unknown error: web view not found\n  (Session info: chrome=133.0.6943.127)\n  (Driver info: chromedriver=133.0.6943.53 (9a80935019b0925b01cc21d254da203bc3986f04-refs/branch-heads/6943@{#1389}),platform=Windows NT 10.0.22631 x86_64)"
        ],
        "trace": [
            "NoSuchWindowError: no such window: target window already closed\nfrom unknown error: web view not found\n  (Session info: chrome=133.0.6943.127)\n  (Driver info: chromedriver=133.0.6943.53 (9a80935019b0925b01cc21d254da203bc3986f04-refs/branch-heads/6943@{#1389}),platform=Windows NT 10.0.22631 x86_64)\n    at Object.checkLegacyResponse (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:546:15)\n    at parseHttpResponse (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:441:30\n    at processTicksAndRejections (node:internal/process/task_queues:105:5)\nFrom: Task: Protractor.waitForAngular() - Locator: by.ngClick(\"transactions()\")\n    at Driver.schedule (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at ProtractorBrowser.executeAsyncScript_ (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:423:28)\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:454:33\n    at ManagedPromise.invokeCallback_ (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.<computed> [as click] (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.<computed> [as click] (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at customerinfo.gototransactions (C:\\Users\\SHVYSYAR\\OneDrive - Capgemini\\Documents\\Protractorpageobject\\pages\\customerinfo.js:88:147)\n    at UserContext.<anonymous> (C:\\Users\\SHVYSYAR\\OneDrive - Capgemini\\Documents\\Protractorpageobject\\test_spec\\customerinfo_spec.js:51:18)\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\nFrom: Task: Run it(\"goto customertransaction page\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\SHVYSYAR\\OneDrive - Capgemini\\Documents\\Protractorpageobject\\test_spec\\customerinfo_spec.js:49:3)\n    at addSpecsToSuite (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\SHVYSYAR\\OneDrive - Capgemini\\Documents\\Protractorpageobject\\test_spec\\customerinfo_spec.js:5:1)\n    at Module._compile (node:internal/modules/cjs/loader:1739:14)\n    at Object..js (node:internal/modules/cjs/loader:1904:10)\n    at Module.load (node:internal/modules/cjs/loader:1473:32)\n    at Function._load (node:internal/modules/cjs/loader:1285:12)",
            "NoSuchWindowError: no such window: target window already closed\nfrom unknown error: web view not found\n  (Session info: chrome=133.0.6943.127)\n  (Driver info: chromedriver=133.0.6943.53 (9a80935019b0925b01cc21d254da203bc3986f04-refs/branch-heads/6943@{#1389}),platform=Windows NT 10.0.22631 x86_64)\n    at Object.checkLegacyResponse (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:546:15)\n    at parseHttpResponse (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:441:30\n    at processTicksAndRejections (node:internal/process/task_queues:105:5)\nFrom: Task: WebDriver.takeScreenshot()\n    at Driver.schedule (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at Driver.takeScreenshot (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:1085:17)\n    at run (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:58:33)\n    at ProtractorBrowser.to.<computed> [as takeScreenshot] (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:66:16)\n    at UserContext.<anonymous> (C:\\Users\\SHVYSYAR\\OneDrive - Capgemini\\Documents\\Protractorpageobject\\conf\\conf.js:56:13)\n    at attempt (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\SHVYSYAR\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9"
        ],
        "browserLogs": [],
        "timestamp": 1740633171528,
        "duration": 1034
    }
];

    this.sortSpecs = function () {
        this.results = results.sort(function sortFunction(a, b) {
    if (a.sessionId < b.sessionId) return -1;else if (a.sessionId > b.sessionId) return 1;

    if (a.timestamp < b.timestamp) return -1;else if (a.timestamp > b.timestamp) return 1;

    return 0;
});

    };

    this.setTitle = function () {
        var title = $('.report-title').text();
        titleService.setTitle(title);
    };

    // is run after all test data has been prepared/loaded
    this.afterLoadingJobs = function () {
        this.sortSpecs();
        this.setTitle();
    };

    this.loadResultsViaAjax = function () {

        $http({
            url: './combined.json',
            method: 'GET'
        }).then(function (response) {
                var data = null;
                if (response && response.data) {
                    if (typeof response.data === 'object') {
                        data = response.data;
                    } else if (response.data[0] === '"') { //detect super escaped file (from circular json)
                        data = CircularJSON.parse(response.data); //the file is escaped in a weird way (with circular json)
                    } else {
                        data = JSON.parse(response.data);
                    }
                }
                if (data) {
                    results = data;
                    that.afterLoadingJobs();
                }
            },
            function (error) {
                console.error(error);
            });
    };


    if (clientDefaults.useAjax) {
        this.loadResultsViaAjax();
    } else {
        this.afterLoadingJobs();
    }

}]);

app.filter('bySearchSettings', function () {
    return function (items, searchSettings) {
        var filtered = [];
        if (!items) {
            return filtered; // to avoid crashing in where results might be empty
        }
        var prevItem = null;

        for (var i = 0; i < items.length; i++) {
            var item = items[i];
            item.displaySpecName = false;

            var isHit = false; //is set to true if any of the search criteria matched
            countLogMessages(item); // modifies item contents

            var hasLog = searchSettings.withLog && item.browserLogs && item.browserLogs.length > 0;
            if (searchSettings.description === '' ||
                (item.description && item.description.toLowerCase().indexOf(searchSettings.description.toLowerCase()) > -1)) {

                if (searchSettings.passed && item.passed || hasLog) {
                    isHit = true;
                } else if (searchSettings.failed && !item.passed && !item.pending || hasLog) {
                    isHit = true;
                } else if (searchSettings.pending && item.pending || hasLog) {
                    isHit = true;
                }
            }
            if (isHit) {
                checkIfShouldDisplaySpecName(prevItem, item);

                filtered.push(item);
                prevItem = item;
            }
        }

        return filtered;
    };
});

//formats millseconds to h m s
app.filter('timeFormat', function () {
    return function (tr, fmt) {
        if(tr == null){
            return "NaN";
        }

        switch (fmt) {
            case 'h':
                var h = tr / 1000 / 60 / 60;
                return "".concat(h.toFixed(2)).concat("h");
            case 'm':
                var m = tr / 1000 / 60;
                return "".concat(m.toFixed(2)).concat("min");
            case 's' :
                var s = tr / 1000;
                return "".concat(s.toFixed(2)).concat("s");
            case 'hm':
            case 'h:m':
                var hmMt = tr / 1000 / 60;
                var hmHr = Math.trunc(hmMt / 60);
                var hmMr = hmMt - (hmHr * 60);
                if (fmt === 'h:m') {
                    return "".concat(hmHr).concat(":").concat(hmMr < 10 ? "0" : "").concat(Math.round(hmMr));
                }
                return "".concat(hmHr).concat("h ").concat(hmMr.toFixed(2)).concat("min");
            case 'hms':
            case 'h:m:s':
                var hmsS = tr / 1000;
                var hmsHr = Math.trunc(hmsS / 60 / 60);
                var hmsM = hmsS / 60;
                var hmsMr = Math.trunc(hmsM - hmsHr * 60);
                var hmsSo = hmsS - (hmsHr * 60 * 60) - (hmsMr*60);
                if (fmt === 'h:m:s') {
                    return "".concat(hmsHr).concat(":").concat(hmsMr < 10 ? "0" : "").concat(hmsMr).concat(":").concat(hmsSo < 10 ? "0" : "").concat(Math.round(hmsSo));
                }
                return "".concat(hmsHr).concat("h ").concat(hmsMr).concat("min ").concat(hmsSo.toFixed(2)).concat("s");
            case 'ms':
                var msS = tr / 1000;
                var msMr = Math.trunc(msS / 60);
                var msMs = msS - (msMr * 60);
                return "".concat(msMr).concat("min ").concat(msMs.toFixed(2)).concat("s");
        }

        return tr;
    };
});


function PbrStackModalController($scope, $rootScope) {
    var ctrl = this;
    ctrl.rootScope = $rootScope;
    ctrl.getParent = getParent;
    ctrl.getShortDescription = getShortDescription;
    ctrl.convertTimestamp = convertTimestamp;
    ctrl.isValueAnArray = isValueAnArray;
    ctrl.toggleSmartStackTraceHighlight = function () {
        var inv = !ctrl.rootScope.showSmartStackTraceHighlight;
        ctrl.rootScope.showSmartStackTraceHighlight = inv;
    };
    ctrl.applySmartHighlight = function (line) {
        if ($rootScope.showSmartStackTraceHighlight) {
            if (line.indexOf('node_modules') > -1) {
                return 'greyout';
            }
            if (line.indexOf('  at ') === -1) {
                return '';
            }

            return 'highlight';
        }
        return '';
    };
}


app.component('pbrStackModal', {
    templateUrl: "pbr-stack-modal.html",
    bindings: {
        index: '=',
        data: '='
    },
    controller: PbrStackModalController
});

function PbrScreenshotModalController($scope, $rootScope) {
    var ctrl = this;
    ctrl.rootScope = $rootScope;
    ctrl.getParent = getParent;
    ctrl.getShortDescription = getShortDescription;

    /**
     * Updates which modal is selected.
     */
    this.updateSelectedModal = function (event, index) {
        var key = event.key; //try to use non-deprecated key first https://developer.mozilla.org/de/docs/Web/API/KeyboardEvent/keyCode
        if (key == null) {
            var keyMap = {
                37: 'ArrowLeft',
                39: 'ArrowRight'
            };
            key = keyMap[event.keyCode]; //fallback to keycode
        }
        if (key === "ArrowLeft" && this.hasPrevious) {
            this.showHideModal(index, this.previous);
        } else if (key === "ArrowRight" && this.hasNext) {
            this.showHideModal(index, this.next);
        }
    };

    /**
     * Hides the modal with the #oldIndex and shows the modal with the #newIndex.
     */
    this.showHideModal = function (oldIndex, newIndex) {
        const modalName = '#imageModal';
        $(modalName + oldIndex).modal("hide");
        $(modalName + newIndex).modal("show");
    };

}

app.component('pbrScreenshotModal', {
    templateUrl: "pbr-screenshot-modal.html",
    bindings: {
        index: '=',
        data: '=',
        next: '=',
        previous: '=',
        hasNext: '=',
        hasPrevious: '='
    },
    controller: PbrScreenshotModalController
});

app.factory('TitleService', ['$document', function ($document) {
    return {
        setTitle: function (title) {
            $document[0].title = title;
        }
    };
}]);


app.run(
    function ($rootScope, $templateCache) {
        //make sure this option is on by default
        $rootScope.showSmartStackTraceHighlight = true;
        
  $templateCache.put('pbr-screenshot-modal.html',
    '<div class="modal" id="imageModal{{$ctrl.index}}" tabindex="-1" role="dialog"\n' +
    '     aria-labelledby="imageModalLabel{{$ctrl.index}}" ng-keydown="$ctrl.updateSelectedModal($event,$ctrl.index)">\n' +
    '    <div class="modal-dialog modal-lg m-screenhot-modal" role="document">\n' +
    '        <div class="modal-content">\n' +
    '            <div class="modal-header">\n' +
    '                <button type="button" class="close" data-dismiss="modal" aria-label="Close">\n' +
    '                    <span aria-hidden="true">&times;</span>\n' +
    '                </button>\n' +
    '                <h6 class="modal-title" id="imageModalLabelP{{$ctrl.index}}">\n' +
    '                    {{$ctrl.getParent($ctrl.data.description)}}</h6>\n' +
    '                <h5 class="modal-title" id="imageModalLabel{{$ctrl.index}}">\n' +
    '                    {{$ctrl.getShortDescription($ctrl.data.description)}}</h5>\n' +
    '            </div>\n' +
    '            <div class="modal-body">\n' +
    '                <img class="screenshotImage" ng-src="{{$ctrl.data.screenShotFile}}">\n' +
    '            </div>\n' +
    '            <div class="modal-footer">\n' +
    '                <div class="pull-left">\n' +
    '                    <button ng-disabled="!$ctrl.hasPrevious" class="btn btn-default btn-previous" data-dismiss="modal"\n' +
    '                            data-toggle="modal" data-target="#imageModal{{$ctrl.previous}}">\n' +
    '                        Prev\n' +
    '                    </button>\n' +
    '                    <button ng-disabled="!$ctrl.hasNext" class="btn btn-default btn-next"\n' +
    '                            data-dismiss="modal" data-toggle="modal"\n' +
    '                            data-target="#imageModal{{$ctrl.next}}">\n' +
    '                        Next\n' +
    '                    </button>\n' +
    '                </div>\n' +
    '                <a class="btn btn-primary" href="{{$ctrl.data.screenShotFile}}" target="_blank">\n' +
    '                    Open Image in New Tab\n' +
    '                    <span class="glyphicon glyphicon-new-window" aria-hidden="true"></span>\n' +
    '                </a>\n' +
    '                <button type="button" class="btn btn-default" data-dismiss="modal">Close</button>\n' +
    '            </div>\n' +
    '        </div>\n' +
    '    </div>\n' +
    '</div>\n' +
     ''
  );

  $templateCache.put('pbr-stack-modal.html',
    '<div class="modal" id="modal{{$ctrl.index}}" tabindex="-1" role="dialog"\n' +
    '     aria-labelledby="stackModalLabel{{$ctrl.index}}">\n' +
    '    <div class="modal-dialog modal-lg m-stack-modal" role="document">\n' +
    '        <div class="modal-content">\n' +
    '            <div class="modal-header">\n' +
    '                <button type="button" class="close" data-dismiss="modal" aria-label="Close">\n' +
    '                    <span aria-hidden="true">&times;</span>\n' +
    '                </button>\n' +
    '                <h6 class="modal-title" id="stackModalLabelP{{$ctrl.index}}">\n' +
    '                    {{$ctrl.getParent($ctrl.data.description)}}</h6>\n' +
    '                <h5 class="modal-title" id="stackModalLabel{{$ctrl.index}}">\n' +
    '                    {{$ctrl.getShortDescription($ctrl.data.description)}}</h5>\n' +
    '            </div>\n' +
    '            <div class="modal-body">\n' +
    '                <div ng-if="$ctrl.data.trace.length > 0">\n' +
    '                    <div ng-if="$ctrl.isValueAnArray($ctrl.data.trace)">\n' +
    '                        <pre class="logContainer" ng-repeat="trace in $ctrl.data.trace track by $index"><div ng-class="$ctrl.applySmartHighlight(line)" ng-repeat="line in trace.split(\'\\n\') track by $index">{{line}}</div></pre>\n' +
    '                    </div>\n' +
    '                    <div ng-if="!$ctrl.isValueAnArray($ctrl.data.trace)">\n' +
    '                        <pre class="logContainer"><div ng-class="$ctrl.applySmartHighlight(line)" ng-repeat="line in $ctrl.data.trace.split(\'\\n\') track by $index">{{line}}</div></pre>\n' +
    '                    </div>\n' +
    '                </div>\n' +
    '                <div ng-if="$ctrl.data.browserLogs.length > 0">\n' +
    '                    <h5 class="modal-title">\n' +
    '                        Browser logs:\n' +
    '                    </h5>\n' +
    '                    <pre class="logContainer"><div class="browserLogItem"\n' +
    '                                                   ng-repeat="logError in $ctrl.data.browserLogs track by $index"><div><span class="label browserLogLabel label-default"\n' +
    '                                                                                                                             ng-class="{\'label-danger\': logError.level===\'SEVERE\', \'label-warning\': logError.level===\'WARNING\'}">{{logError.level}}</span><span class="label label-default">{{$ctrl.convertTimestamp(logError.timestamp)}}</span><div ng-repeat="messageLine in logError.message.split(\'\\\\n\') track by $index">{{ messageLine }}</div></div></div></pre>\n' +
    '                </div>\n' +
    '            </div>\n' +
    '            <div class="modal-footer">\n' +
    '                <button class="btn btn-default"\n' +
    '                        ng-class="{active: $ctrl.rootScope.showSmartStackTraceHighlight}"\n' +
    '                        ng-click="$ctrl.toggleSmartStackTraceHighlight()">\n' +
    '                    <span class="glyphicon glyphicon-education black"></span> Smart Stack Trace\n' +
    '                </button>\n' +
    '                <button type="button" class="btn btn-default" data-dismiss="modal">Close</button>\n' +
    '            </div>\n' +
    '        </div>\n' +
    '    </div>\n' +
    '</div>\n' +
     ''
  );

    });
