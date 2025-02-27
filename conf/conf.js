var HtmlReporter = require('protractor-beautiful-reporter');
var HTMLReport = require('protractor-html-reporter-2');
var jasmineReporters = require('jasmine-reporters');
 var jasmine2 =  require('jasmine2-protractor-utils');
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
  specs: ['..//test_spec//AddBankManagerDetails_spec.js',],
  //  suites:{sample1:'..//test_spec//AddBankManagerDetails_spec.js',sample2:'..//test_spec//customerinfo_spec.js'
  //  },
  

  // Options to be passed to Jasmine.
  jasmineNodeOpts: {
    defaultTimeoutInterval: 30000
  },

  plugins: [{
    package: 'jasmine2-protractor-utils',
    disableHTMLReport: true,
    disableScreenshot: false,
    screenshotPath:'./screenshots',
    screenshotOnExpectFailure:false,
    screenshotOnSpecFailure:true,
    clearFoldersBeforeTest: true
  }],


onPrepare: function() {

  //browser.ignoreSynchronization=true;
  browser.driver.manage().window().maximize();
  
  //jasmine allure reporter
  var AllureReporter = require('jasmine-allure-reporter');
  jasmine.getEnv().addReporter(new AllureReporter({
    resultsDir: 'allure-results'
  }));


  
  jasmine.getEnv().afterEach(function(done){
    browser.takeScreenshot().then(function (png) {
      allure.createAttachment('Screenshot', function () {
        return new Buffer(png, 'base64')
      }, 'image/png')();
      done();
    })
  });


  //For Protractor-beautiful-reporter
  jasmine.getEnv().addReporter(new HtmlReporter({
    baseDirectory: 'tmp/screenshots'
 }).getJasmine2Reporter());
  var reporter = new HtmlReporter({
    baseDirectory: 'tmp/screenshots',
    
 });


 //
 jasmine.getEnv().addReporter(new jasmineReporters.JUnitXmlReporter({
  consolidateAll: true,
  savePath: './',
  filePrefix: 'xmlresults'
}));
},

onComplete: function() {
  var browserName, browserVersion;
  var capsPromise = browser.getCapabilities();

  capsPromise.then(function (caps) {
     browserName = caps.get('browserName');
     browserVersion = caps.get('version');
     platform = caps.get('platform');

     var HTMLReport = require('protractor-html-reporter-2');

     testConfig = {
         reportTitle: 'Protractor Test Execution Report',
         outputPath: './',
         outputFilename: 'ProtractorTestReport',
         screenshotPath: './screenshots',
         testBrowser: browserName,
         browserVersion: browserVersion,
         modifiedSuiteName: false,
         screenshotsOnlyOnFailure: true,
         testPlatform: platform
     };
     new HTMLReport().from('xmlresults.xml', testConfig);
 });
}


};