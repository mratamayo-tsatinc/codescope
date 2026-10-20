/*
@codescope
@title Accumulate during a countdown
@seed count min=3 max=5
*/
public class CountdownTotal {
    public static void main(String[] args) {
        int count = 4;
        int total = 0;

        while (count > 0) {
            System.out.println("add countdown value");
            total += count;
            count--;
            System.out.println("move countdown lower");
        }

        System.out.println("total " + total);
    }
}

