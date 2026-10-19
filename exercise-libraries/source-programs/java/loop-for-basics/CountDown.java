/*
@codescope
@title Count down with for
@seed start min=3 max=5
*/
public class CountDown {
    public static void main(String[] args) {
        int i;
        int start = 4;

        for (i = start; i > 0; i--) {
            System.out.println(i);
        }

        System.out.println("done");
    }
}

