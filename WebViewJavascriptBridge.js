// h5 调用 native 的方法,统一调用方法为 window.JSBridge.xxx(param,callback,ishold)
var events = [
  'titleBar',
  'titleButton',
  'open',
  'close',
  'resume',
  'pause',
  'pulltorefresh',
  'call',
  'share',
  'login',
  'pay',
  'position',
  'camera',
  'upload',
  'logout',
  'scan',
]
// native 调用 h5 的方法
var receive = {
  functionInJs: function (data, responseCallback) {
    // 这里是android native 调用 H5 的
    console.log('registerHandler 1接收的数据', data)
    if (responseCallback) {
      // 这里是往 native 回传的
      responseCallback({ call: '这是由 native 调用 js 事件,js 给的回调 1' })
    }
  },
  functionJs: function (data, responseCallback) {
    // 这里是android native 调用 H5 的
    console.log('registerHandler 2接收的数据', data)
    if (responseCallback) {
      // 这里是往 native 回传的
      responseCallback({ call: '这是由 native 调用 js 事件,js 给的回调 2' })
    }
  },
}

// 根据 ua 标识判断设备类型
var ua = navigator.userAgent
var IOS = 'ios'
var ANDROID = 'android'
function getDeviceInfo() {
  //获取设备信息
  var device = {
    type: null,
    version: null,
  }
  //设备类型
  if (/\(i[^;]+;( U;)? CPU.+Mac OS X/.test(ua)) {
    device.type = IOS
    // iOS 版本号提取
    var iosVersion = /\b[0-9]+_[0-9]+(?:_[0-9]+)?\b/.exec(ua)
    if (iosVersion && iosVersion[0]) {
      device.version = iosVersion[0].replace(/_/g, '.')
    }
  } else if (/Android/i.test(ua)) {
    device.type = ANDROID
    var match = ua.match(/Android\s+([\d\.]+)/i)
    device.version = match && match[1]
  } else {
    device.type = undefined
  }
  return device
}
var info = getDeviceInfo()

// 根据不同的类型注入不同的 js
if (info.type == IOS) {
  function setupWebViewJavascriptBridge(callback) {
    if (window.WebViewJavascriptBridge) {
      callback(WebViewJavascriptBridge)
    } else {
      document.addEventListener(
        'WebViewJavascriptBridgeReady',
        function () {
          callback(WebViewJavascriptBridge)
        },
        false
      )
    }
    // iOS的特殊处理
    if (window.WVJBCallbacks) {
      return window.WVJBCallbacks.push(callback)
    }
    window.WVJBCallbacks = [callback]
    var WVJBIframe = document.createElement('iframe')
    WVJBIframe.style.display = 'none'
    WVJBIframe.src = 'wvjbscheme://__BRIDGE_LOADED__'
    document.documentElement.appendChild(WVJBIframe)
    setTimeout(function () {
      document.documentElement.removeChild(WVJBIframe)
    }, 0)
  }

  setupWebViewJavascriptBridge(function (bridge) {
    // 这个是 os 调用 js 的地方,因为Bridge是由 java 注入的,所以判断一下异常
    if (bridge.registerHandler) {
      try {
        for (key in receive) {
          bridge.registerHandler(key, receive[key])
        }
      } catch (error) {
        console.log('ios 调用失败', error)
      }
    }
  })
} else if (info.type == ANDROID) {
  // 注入 android 的 Bridge
  ;(function () {
    if (window.WebViewJavascriptBridge) {
      return
    }
    var messagingIframe
    var bizMessagingIframe
    var sendMessageQueue = []
    var receiveMessageQueue = []
    var messageHandlers = {}

    var CUSTOM_PROTOCOL_SCHEME = 'yy'
    var QUEUE_HAS_MESSAGE = '__QUEUE_MESSAGE__/'

    var responseCallbacks = {}
    var uniqueId = 1

    // 创建消息index队列iframe
    function _createQueueReadyIframe(doc) {
      messagingIframe = doc.createElement('iframe')
      messagingIframe.style.display = 'none'
      doc.documentElement.appendChild(messagingIframe)
    }
    //创建消息体队列iframe
    function _createQueueReadyIframe4biz(doc) {
      bizMessagingIframe = doc.createElement('iframe')
      bizMessagingIframe.style.display = 'none'
      doc.documentElement.appendChild(bizMessagingIframe)
    }
    //set default messageHandler  初始化默认的消息线程
    function init(messageHandler) {
      if (WebViewJavascriptBridge._messageHandler) {
        throw new Error('WebViewJavascriptBridge.init called twice')
      }
      WebViewJavascriptBridge._messageHandler = messageHandler
      var receivedMessages = receiveMessageQueue
      receiveMessageQueue = null
      for (var i = 0; i < receivedMessages.length; i++) {
        _dispatchMessageFromNative(receivedMessages[i])
      }
    }

    // 发送
    function send(data, responseCallback) {
      _doSend(
        {
          data: data,
        },
        responseCallback
      )
    }

    // 注册线程 往数组里面添加值
    function registerHandler(handlerName, handler) {
      messageHandlers[handlerName] = handler
    }
    // 调用线程
    function callHandler(handlerName, data, responseCallback) {
      _doSend(
        {
          handlerName: handlerName,
          data: data,
        },
        responseCallback
      )
    }

    //sendMessage add message, 触发native处理 sendMessage
    function _doSend(message, responseCallback) {
      if (responseCallback) {
        var callbackId = 'cb_' + uniqueId++ + '_' + new Date().getTime()
        responseCallbacks[callbackId] = responseCallback
        message.callbackId = callbackId
      }

      sendMessageQueue.push(message)
      messagingIframe.src = CUSTOM_PROTOCOL_SCHEME + '://' + QUEUE_HAS_MESSAGE
    }

    // 提供给native调用,该函数作用:获取sendMessageQueue返回给native,由于android不能直接获取返回的内容,所以使用url shouldOverrideUrlLoading 的方式返回内容
    function _fetchQueue() {
      var messageQueueString = JSON.stringify(sendMessageQueue)
      sendMessageQueue = []
      //android can't read directly the return data, so we can reload iframe src to communicate with java
      if (messageQueueString !== '[]') {
        bizMessagingIframe.src =
          CUSTOM_PROTOCOL_SCHEME +
          '://return/_fetchQueue/' +
          encodeURIComponent(messageQueueString)
      }
    }

    //提供给native使用,
    function _dispatchMessageFromNative(messageJSON) {
      setTimeout(function () {
        var message = JSON.parse(messageJSON)
        var responseCallback
        //java call finished, now need to call js callback function
        if (message.responseId) {
          responseCallback = responseCallbacks[message.responseId]
          if (!responseCallback) {
            return
          }
          responseCallback(message.responseData)
          delete responseCallbacks[message.responseId]
        } else {
          //直接发送
          if (message.callbackId) {
            var callbackResponseId = message.callbackId
            responseCallback = function (responseData) {
              _doSend({
                responseId: callbackResponseId,
                responseData: responseData,
              })
            }
          }

          var handler = WebViewJavascriptBridge._messageHandler
          if (message.handlerName) {
            handler = messageHandlers[message.handlerName]
          }
          //查找指定handler
          try {
            handler(message.data, responseCallback)
          } catch (exception) {
            if (typeof console != 'undefined') {
              console.log(
                'WebViewJavascriptBridge: WARNING: javascript handler threw.',
                message,
                exception
              )
            }
          }
        }
      })
    }

    //提供给native调用,receiveMessageQueue 在会在页面加载完后赋值为null,所以
    function _handleMessageFromNative(messageJSON) {
      console.log(messageJSON)
      if (receiveMessageQueue) {
        receiveMessageQueue.push(messageJSON)
      }
      _dispatchMessageFromNative(messageJSON)
    }

    var WebViewJavascriptBridge = (window.WebViewJavascriptBridge = {
      init: init,
      send: send,
      registerHandler: registerHandler,
      callHandler: callHandler,
      _fetchQueue: _fetchQueue,
      _handleMessageFromNative: _handleMessageFromNative,
    })

    var doc = document
    _createQueueReadyIframe(doc)
    _createQueueReadyIframe4biz(doc)
    var readyEvent = doc.createEvent('Events')
    readyEvent.initEvent('WebViewJavascriptBridgeReady')
    readyEvent.bridge = WebViewJavascriptBridge
    doc.dispatchEvent(readyEvent)
  })()
  if (
    window.WebViewJavascriptBridge &&
    window.WebViewJavascriptBridge.registerHandler
  ) {
    // 这个是 android 调用 js 的地方
    for (key in receive) {
      window.WebViewJavascriptBridge.registerHandler(key, receive[key])
    }
  }
}
var JSBridge = {
  device: info,
  eventMap: {
    //事件队列
  },
  uid: 0,
  // 根据不同的端调用不同的方法,目前是一样的,为了防止两边变化注入的值,所以还是分开调用
  deviceRouter: function (method, params, callback, isHold) {
    if (this.device.type == IOS) {
      this.iosMethod(method, params, callback, isHold)
    } else if (this.device.type == ANDROID) {
      this.androidMethod(method, params, callback, isHold)
    } else {
      console.error(
        '请在native端使用此方法：' + method,
        params,
        callback,
        isHold
      )
    }
  },
  // ios 方法
  iosMethod: function (method, params, callback, isHold) {
    window.WebViewJavascriptBridge.callHandler(method, params, callback)
  },
  // 安卓方法
  androidMethod: function (method, params, callback, isHold) {
    window.WebViewJavascriptBridge.callHandler(method, params, callback)
  },
}
// 向 Bridge 中添加 H5 调用的事件
for (var i = 0; i < events.length; i++) {
  var event = events[i]
  JSBridge[event] = (function (event) {
    return function (params, callback, isHold) {
      this.deviceRouter(event, params, callback, isHold)
    }
  })(event)
}
// 挂载到 window
window.JSBridge = JSBridge
