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
            total += count;
            count--;
        }

        System.out.println("total " + total);
    }
}

