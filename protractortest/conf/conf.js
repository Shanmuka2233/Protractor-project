// An example configuration file.
// var jasminereporter=require('protractor-jasmine2-html-reporter');
//var HtmlReporter=require('protractor-beautiful-reporter');
// var Htmlreport=require('protractor-html-reporter-2');
// var jasminereport=require('jasmine-reporters');
 var AllureReporter = require('jasmine-allure-reporter');
exports.config = {
  directConnect: true,

  // Capabilities to be passed to the webdriver instance.
  capabilities: {
    'browserName': 'chrome',
    shardTestFiles: true,
    maxInstances: 2,
  },
  // Framework to use. Jasmine is recommended.
  framework: 'jasmine',

  // Spec patterns are relative to the current working directory when
  // protractor is called.
  specs: ['..//test_spec//Samplepagesuccestest_spec.js'],
  //  suites:{sample1:'..//test_spec//AddBankManagerDetails_spec.js',sample2:'..//test_spec//customerinfo_spec.js'
  //  },
  

  // Options to be passed to Jasmine.
  jasmineNodeOpts: {
    defaultTimeoutInterval: 30000
  },

  onPrepare: function(){
    browser.ignoreSynchronization=true;
    browser.driver.manage().window().maximize();
    // jasmine.getEnv().addReporter(new jasminereporter({
    //     savePath:'.testsreports',
    //     screenshotsFolder:'images',
    //     fileNamePrefix:'SamplePractice',
    //     fileNameDateSuffix:true

    // }))
   // Protractor beatiful report
    //   jasmine.getEnv().addReporter(new HtmlReporter({
    //     baseDirectory:'tmp/screenshots'

    // }).getJasmine2Reporter);
    // var reporter = new HtmlReporter({
    //   baseDirectory:'tmp/screenshots'
    // });

    //html reporter2
  //   jasmine.getEnv().addReporter(new jasminereport.JUnitXmlReporter({
  //     consolidateAll: true,
  //     savePath: './',
  //     filePrefix: 'xmlresults'
  // }));

    // allure report
    var AllureReporter = require('jasmine-allure-reporter');
    jasmine.getEnv().addReporter(new AllureReporter({
        allureReport: {
            resultsDir: 'allure-results'
        }
    }));
    jasmine.getEnv().afterEach(function (done) {
      browser.takeScreenshot().then(function (png) {
          allure.createAttachment('Screenshot', function () {
              return new Buffer(png, 'base64')
          }, 'image/png')();
          done();
      })
    });

    // },
  // plugins: [{
  //   package: 'jasmine2-protractor-utils',
  //   disableHTMLReport: true,
  //   disableScreenshot: false,
  //   screenshotPath:'./screenshots',
  //   screenshotOnExpectFailure:false,
  //   screenshotOnSpecFailure:true,
  //   clearFoldersBeforeTest: true
  // }],
  // onComplete: function() {
  //   var browserName, browserVersion;
  //   var capsPromise = browser.getCapabilities();

  //   capsPromise.then(function (caps) {
  //      browserName = caps.get('browserName');
  //      browserVersion = caps.get('version');
  //      platform = caps.get('platform');

  //      var HTMLReport = require('protractor-html-reporter-2');

  //      testConfig = {
  //          reportTitle: 'Protractor Test Execution Report',
  //          outputPath: './',
  //          outputFilename: 'ProtractorTestReport',
  //          screenshotPath: './screenshots',
  //          testBrowser: browserName,
  //          browserVersion: browserVersion,
  //          modifiedSuiteName: false,
  //          screenshotsOnlyOnFailure: false,
  //          testPlatform: platform
  //      };
  //      new HTMLReport().from('xmlresults.xml', testConfig);
  //  });
  }
};
