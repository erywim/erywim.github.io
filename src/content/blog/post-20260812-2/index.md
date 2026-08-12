---
title: 'ThreadLocal 、 实例变量、静态变量 以及 局部变量的区别'
description: 'ThreadLocal 作用辨析'
publishDate: 2026-08-12
rank: B
category: 技术
tags: [Java]
draft: false
---

## ThreadLocal 的作用

ThreadLocal 用于声明一个变量，这个变量在每个 `线程` 中都会创建一份实例，各个线程之间的数据不能共享，某个线程中的 `ThreadLocal` 变量与线程进行绑定，能够保证变量的线程安全。
使用示例一：
```java
/**  
 * @author Erywim 2024/4/16  
 */public class Temp {  
    public static void main(String[] args) {  
        ThreadTest threadTest = new ThreadTest();  
        Thread t1 = new Thread(threadTest, "t1");  
		Thread t2 = new Thread(threadTest, "t2");  
        t1.start();  
        // 暂停1秒  
        try { TimeUnit.SECONDS.sleep(1); } catch (InterruptedException e) { e.printStackTrace(); }  
        t2.start();  
    }}
  
@Data  
class ThreadTest implements Runnable {  
    private ThreadLocal<Integer> local = new ThreadLocal<>().withInitial(() -> 0);  
    @Override  
    public void run() {  
        local.set(local.get() + 1);  
        System.out.println(Thread.currentThread().getName()+"    local.get() = " + local.get());  
    }  
}
```

其中 `t1` 线程和 `t2` 线程都会拥有一个专属于自己线程的 `local` 变量，其值为初始值 `0` 。所以最终输出的结果是
```text
t1    local.get() = 1
t2    local.get() = 1
```

使用示例二：如果对于创建的线程类实例操作，将其 `local` 属性先修改为其他的值，然后再用该实例创建线程
```java
/**  
 * @author Erywim 2024/4/16  
 */public class Temp {  
    public static void main(String[] args) {  
        ThreadTest threadTest = new ThreadTest();  
        Thread t1 = new Thread(threadTest, "t1");  
        t1.start();  
        // 暂停秒  
        try { TimeUnit.SECONDS.sleep(1); } catch (InterruptedException e) { e.printStackTrace(); }  

		//即便是主线程进行了修改其中的 ThreadLocal 变量，子线程中的 ThreadLocal 也不会变  
        threadTest.getLocal().set(100);  
        System.out.println("threadTest.local.get() = " + threadTest.getLocal().get());

        //如果修改的是线程类的实例数据，则子线程中的数据也会跟着改变  
        System.out.println(Thread.currentThread().getName() + "  count = " + threadTest.getCount());  
        threadTest.setCount(1000);  
        System.out.println(Thread.currentThread().getName() + "  count = " + threadTest.getCount());  
  
        try { TimeUnit.SECONDS.sleep(1); } catch (InterruptedException e) { e.printStackTrace(); }  
        Thread t2 = new Thread(threadTest, "t2");  
        t2.start();  
    }
 }  
   
@Data  
class ThreadTest implements Runnable {  
    private ThreadLocal<Integer> local = new ThreadLocal<>().withInitial(() -> 0);  
    private int count = 0;  
    @Override  
    public void run() {  
        local.set(local.get() + 1);  
        System.out.println(Thread.currentThread().getName()+"    local.get() = " + local.get());  
  
        count++;  
        System.out.println(Thread.currentThread().getName() + "  count = " + count);  
    }
}
```

对比实例变量 `count` ，在主线程进行值的修改后，再作为线程进行启动，由于用的是同一个线程类的实例对象创建的两个线程，所以  `t1` 线程和 `t2` 线程中的实例对象是共享的，且与主线程中的线程类的实例对象也共享。所以最终的结果为
```text
t1    local.get() = 1
t1  count = 1
main  threadTest.local.get() = 100
main  count = 1
main  count = 1000
t2    local.get() = 1
t2  count = 1001
```

即：主线程对于线程类实例中 `ThreadLocal` 属性的更改不会影响到子线程执行时的值，子线程如果是初次创建的话，则永远是从 `initial` 时指定的初始值开始计算的。

## 对比 `实例变量`  、`静态变量` 和 `局部变量` 

### 实例变量（成员变量）

`实例变量` 存在于 `堆内存` 中，<font color="#c00000">随着实例对象的创建而创建</font>。如果多个线程使用的是同一个实例对象创建的，那么这些创建出来的线程将共享线程实例对象中的实例变量。
示例代码：
```java
/**  
 * @author Erywim 2024/4/16  
 */public class Temp {  
	    public static void main(String[] args) {
	    ThreadTest threadTest = new ThreadTest();  
	    //线程 t1 更改count的值  
	    Thread t1 = new Thread(threadTest, "t1");  
	    t1.start();  
	    // 暂停秒  
	    try { TimeUnit.SECONDS.sleep(1); } catch (InterruptedException e) { e.printStackTrace(); }  
	    //当前count的值  
	    System.out.println(Thread.currentThread().getName() + "   threadTest.getCount() = " + threadTest.getCount());  
	    //main 线程更改count的值  
	    threadTest.setCount(2000);  
	    System.out.println(Thread.currentThread().getName() + "   threadTest.getCount() = " + threadTest.getCount());  
	  
	    //线程 t2 也更改count的值  
	    Thread t2 = new Thread(threadTest, "t2");  
	    t2.start();  
	}
}  
  
  
@Data  
class ThreadTest implements Runnable {  
    private ThreadLocal<Integer> local = new ThreadLocal<>().withInitial(() -> 0);  
    private int count = 0;  
    @Override  
    public void run() {
        count++;  
        System.out.println(Thread.currentThread().getName() + "  count = " + count);  
    }}

```

主线程和子线程共享同一个线程实例对象，所以 count 值他们都能进行修改，最终结果输出为：
```text
t1  count = 1
main   threadTest.getCount() = 1
main   threadTest.getCount() = 2000
t2  count = 2001
```

### 静态变量（类变量）

`静态变量` 也称 `类变量`，存放在 `方法区` ，所有由这个类的 `模板` 创建的 `实例对象` 都能共享这个变量的值，一个实例对象修改了 `静态变量` 则其他所有实例对象中的 `静态变量` 的值都会被修改，他们本质指的是同一个值。
示例代码：
```java
/**  
 * @author Erywim 2024/4/16  
 */
public class Temp {  
    public static void main(String[] args) {
	    ThreadTest threadTest = new ThreadTest();  
	    ThreadTest threadTest2 = new ThreadTest();  
	    Thread t1 = new Thread(threadTest, "t1");  
	    Thread t2 = new Thread(threadTest2, "t2");  
	    t1.start();  
	    // 暂停秒  
	    try { TimeUnit.SECONDS.sleep(1); } catch (InterruptedException e) { e.printStackTrace(); }  
	    System.out.println(Thread.currentThread().getName() + "   threadTest.getCount() = " + ThreadTest.count);  
	    ThreadTest.count = 2000;  
	  
	    t2.start();  
	    System.out.println(Thread.currentThread().getName() + "   threadTest.getCount() = " + ThreadTest.count);  
	}
}

@Data  
class ThreadTest implements Runnable {  
    private ThreadLocal<Integer> local = new ThreadLocal<>().withInitial(() -> 0);  
    public static int count = 0;  
    @Override  
    public void run() {  
        local.set(local.get() + 1);  
        System.out.println(Thread.currentThread().getName()+"    local.get() = " + local.get());  
//        int count = 0;  
        count++;  
        System.out.println(Thread.currentThread().getName() + "  count = " + count);  
    }}
```

虽然 `t1` 和 `t2` 使用的是两个实例对象，但是其静态变量是共享的，所以最终展现出来的是 `main` 、`t1` 和 `t2` 共同修改的结果：
```text
t1  count = 1
main   threadTest.getCount() = 1
main   threadTest.getCount() = 2000
t2  count = 2001
```

### 局部变量

`局部变量` 存在于 `栈区` ，是随着方法的被调用而产生，随着方法执行结束而释放的变量。每执行一次方法都会产生全新的局部变量，与之前执行的状态无关。

笔者认为这个类型的变量和 `ThreadLocal` 类似
示例代码：
```java
/**  
 * @author Erywim 2024/4/16  
 */
public class Temp {  
    public static void main(String[] args) {
        ThreadTest threadTest = new ThreadTest();  
        Thread t1 = new Thread(threadTest, "t1");  
        t1.start();  
        // 暂停秒  
        try { TimeUnit.SECONDS.sleep(1); } catch (InterruptedException e) { e.printStackTrace(); }  
  
        Thread t2 = new Thread(threadTest, "t2");  
        t2.start();  
    }  
}  
@Data  
class ThreadTest implements Runnable {  
    @Override  
    public void run() {  
        int count = 0;  
        count++;  
        System.out.println(Thread.currentThread().getName() + "  count = " + count);  
    }}
```

局部变量只存在于方法内部，不进行共享，所以 `t1` 线程和 `t2` 线程中的 `count` 都为 1，结果为：
```text
t1  count = 1
t2  count = 1
```

## ThreadLocal 和 局部变量的区别
笔者认为：
在多线程简单的应用场景中，例如：某个线程的作用只是运行了一个方法，而其中用到的变量每次都是在方法启动时初始化，方法执行完就销毁，那么 `ThreadLocal` 和 `局部变量` 的差别不大。

但是，`ThreadLocal` 最重要的一个特性是这个变量与线程进行绑定了，也就是说在使用线程池的情况下，这个线程在多次被重复使用的时候，其值是可以保留上一次执行的最终结果的，这个变量是线程独立的。

>（tip：使用 `InheritableThreadLocal` 可以让子线程继承父线程的值）










































