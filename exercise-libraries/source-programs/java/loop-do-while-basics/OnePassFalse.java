/*
@codescope
@title See the false test after one pass
@seed score min=7 max=9
@seed target min=4 max=6
*/
public class OnePassFalse {
    public static void main(String[] args) {
        int score = 8;
        int target = 5;

        do {
            score++;
            System.out.println(score);
        } while (score < target);

        System.out.println("stopped " + score);
    }
}

