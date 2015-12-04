

function async(fn) {
	return function() {
		var args = arguments;
		var ctx = this;
		
		function spawn(genF) {
			return new Promise(function(resolve, reject) {
				var gen = genF.apply(ctx, args);
				
				function step(nextF) {
					try {
						var next = nextF();
					} catch (e) {
						return reject(e);
					}
					
					if (next.done) {
						return resolve(next.value);
					}
					
					Promise.resolve(next.value).then(
						v => step(() => gen.next(v)),
						e => step(() => gen.throw(e))
					);
				}
				
				step(() => gen.next() );
			});	
		}
		
		return spawn(fn);
	}
}


function getStockSymbol(name) {
	return name;
}

function getStockPrice(symbol) {
	return symbol;
}

function *getStockPriceByName(name) {
	// console.log(name);
	
	var symbol = yield getStockSymbol(name);
	var stockPrice = yield getStockPrice(symbol);

	return stockPrice;
}


var getStockPriceByNameAsync = async(getStockPriceByName);


getStockPriceByNameAsync('goog').then(function(value) {
	console.log(value);	
});




function *timeout(ms) {
	return new Promise((resolve) => {
		setTimeout(resolve, ms);
	});
}

var asyncPrint = async(function*(value, ms) {
	yield timeout(ms);
	console.log(value);
});

asyncPrint("hello world", 50);


