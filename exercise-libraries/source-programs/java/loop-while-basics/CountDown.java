/*
@codescope
@title Count down with while
@seed count min=3 max=5
*/
public class CountDown {
    public static void main(String[] args) {
        int count = 4;

        while (count > 0) {
            System.out.println("countdown round");
            System.out.println(count);
            count--;
            System.out.println("next count follows");
        }

        System.out.println("lift off");
    }
}

