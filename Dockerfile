FROM python:3.6-buster

ENV PXLS_ANALYZE_TEXT 1

ENV BAZEL_VERSION 0.21.0
ENV TENSORFLOW_VERSION 1.13

# Install Nonde
RUN apt-get update \
  && apt-get upgrade -y \
  && curl -sL https://deb.nodesource.com/setup_12.x | bash - \
  && apt-get install -y nodejs

# Build Tensorflow, this is to run on non popular hardware e.g. Intel Atom CPUs
RUN apt-get update \
  && apt-get upgrade -y \
  # Install Python and the TensorFlow package dependencies
  # && apt install -y python-dev python-pip \
  && apt-get install -y python3-dev python3-pip \
  && pip install -U --user pip six numpy wheel mock \
  && pip install -U --user keras_applications==1.0.6 --no-deps \
  && pip install -U --user keras_preprocessing==1.0.5 --no-deps \
  # Install Bazel
  && apt-get install -y pkg-config zip g++ zlib1g-dev unzip python \
  && apt-get install -y  default-jdk \
  && cd /tmp \
  && wget https://github.com/bazelbuild/bazel/releases/download/${BAZEL_VERSION}/bazel-${BAZEL_VERSION}-installer-linux-x86_64.sh \
  && chmod +x bazel-${BAZEL_VERSION}-installer-linux-x86_64.sh \
  && ./bazel-${BAZEL_VERSION}-installer-linux-x86_64.sh \
  && rm bazel-${BAZEL_VERSION}-installer-linux-x86_64.sh \
  #
  && cd /tmp \
  && git clone https://github.com/tensorflow/tensorflow.git \
  && cd tensorflow \
  && git checkout r${TENSORFLOW_VERSION} \
  && ./configure \
  && bazel build --config=opt //tensorflow/tools/pip_package:build_pip_package \
  && ./bazel-bin/tensorflow/tools/pip_package/build_pip_package /tmp/tensorflow_pkg \ 
  && WHL_FILE=$(ls /tmp/tensorflow_pkg/) \
  && pip install /tmp/tensorflow_pkg/$WHL_FILE

# Install pxls
COPY . /pxls

RUN cd /pxls \
  && make install

CMD ["/bin/bash", "-c", "cd /pxls && node pxls.js"]
