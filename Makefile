install:

	npm install

	echo "jquery.com..."
	cd public/ && \
	mkdir -p lib/jquery.com && \
	cd lib/jquery.com  && \
	wget -O jquery-2.2.4.min.js https://code.jquery.com/jquery-2.2.4.min.js

	cd public/ && \
	mkdir -p lib/blueimp && \
	cd lib/blueimp  && \
	wget https://github.com/blueimp/jQuery-File-Upload/archive/9.12.5.tar.gz && \
	tar xvzf 9.12.5.tar.gz

	cd public/ && \
	mkdir -p lib/mattbryson && \
	cd lib/mattbryson  && \
	wget https://github.com/mattbryson/TouchSwipe-Jquery-Plugin/archive/1.6.18.tar.gz && \
	tar xvzf 1.6.18.tar.gz

	cd public/ && \
	mkdir -p lib/bootstrap && \
	cd lib/bootstrap  && \
	wget https://github.com/twbs/bootstrap/releases/download/v3.3.7/bootstrap-3.3.7-dist.zip && \
	unzip bootstrap-3.3.7-dist.zip

	#mkdir data

	npm run build

	pip install scene_text

clean:
	rm -rf node_modules/
	#rm -rf data
	rm -rf public/lib
	rm -f public/main.js
	rm -rf dist
