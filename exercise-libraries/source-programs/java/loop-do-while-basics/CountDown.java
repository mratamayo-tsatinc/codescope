/*
@codescope
@title Count down with do while
@seed count min=3 max=5
*/
public class CountDown {
    public static void main(String[] args) {
        int count = 4;

        do {
            System.out.println(count);
            count--;
        } while (count > 0);

        System.out.println("done");
    }
}

